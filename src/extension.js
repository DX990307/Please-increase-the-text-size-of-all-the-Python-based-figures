const vscode = require("vscode");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

function activate(context) {
  const output = vscode.window.createOutputChannel("Font Bigger");
  const state = {
    running: false,
    rerunRequested: false
  };

  context.subscriptions.push(output);

  context.subscriptions.push(
    vscode.commands.registerCommand("fontBigger.openStyleFile", async () => {
      const workspaceFolder = getActiveWorkspaceFolder();
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("Font Bigger: open a workspace folder first.");
        return;
      }

      const styleFilePath = getStyleFilePath(workspaceFolder);
      await ensureStyleFileExists(context, styleFilePath, output);
      const document = await vscode.workspace.openTextDocument(styleFilePath);
      await vscode.window.showTextDocument(document, {
        preview: false,
        viewColumn: vscode.ViewColumn.Beside
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fontBigger.openFigureRegistry", async () => {
      const workspaceFolder = getActiveWorkspaceFolder();
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("Font Bigger: open a workspace folder first.");
        return;
      }

      const registryFilePath = getRegistryFilePath(workspaceFolder);
      await ensureFigureRegistryExists(registryFilePath, output);
      const document = await vscode.workspace.openTextDocument(registryFilePath);
      await vscode.window.showTextDocument(document, {
        preview: false,
        viewColumn: vscode.ViewColumn.Beside
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fontBigger.openConfigForFigureUnderCursor", async () => {
      const workspaceFolder = getActiveWorkspaceFolder();
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("Font Bigger: open a workspace folder first.");
        return;
      }

      await openConfigForFigureUnderCursor(workspaceFolder, output);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fontBigger.createStyleFile", async () => {
      const workspaceFolder = getActiveWorkspaceFolder();
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("Font Bigger: open a workspace folder first.");
        return;
      }

      const styleFilePath = getStyleFilePath(workspaceFolder);
      const created = await ensureStyleFileExists(context, styleFilePath, output);
      if (created) {
        vscode.window.showInformationMessage(`Font Bigger: created ${path.relative(workspaceFolder.uri.fsPath, styleFilePath)}.`);
      } else {
        vscode.window.showInformationMessage("Font Bigger: style file already exists.");
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fontBigger.runPipeline", async () => {
      await schedulePipeline(context, output, state, "manual run");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fontBigger.createCompatibleCopy", async () => {
      const workspaceFolder = getActiveWorkspaceFolder();
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("Font Bigger: open a workspace folder first.");
        return;
      }

      await createCompatibleCopy(context, workspaceFolder, output);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (!workspaceFolder) {
        return;
      }

      const config = getConfig(workspaceFolder);
      if (!config.runOnSave) {
        return;
      }

      const styleFilePath = getStyleFilePath(workspaceFolder);
      if (!samePath(document.uri.fsPath, styleFilePath)) {
        return;
      }

      await schedulePipeline(context, output, state, "style file saved", workspaceFolder);
    })
  );
}

async function schedulePipeline(context, output, state, reason, explicitWorkspaceFolder) {
  const workspaceFolder = explicitWorkspaceFolder ?? getActiveWorkspaceFolder();
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("Font Bigger: open a workspace folder first.");
    return;
  }

  if (state.running) {
    state.rerunRequested = true;
    output.appendLine("A run is already in progress. Queued one more run.");
    return;
  }

  state.running = true;

  try {
    let nextReason = reason;

    do {
      state.rerunRequested = false;
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Font Bigger",
          cancellable: false
        },
        async (progress) => {
          progress.report({ message: `Running pipeline (${nextReason})...` });
          await runPipelineOnce(context, workspaceFolder, output, progress);
        }
      );
      nextReason = "queued rerun";
    } while (state.rerunRequested);

    vscode.window.showInformationMessage("Font Bigger: figure regenerated and PDF rebuild finished.");
  } catch (error) {
    output.show(true);
    vscode.window.showErrorMessage(`Font Bigger failed: ${error.message}`);
  } finally {
    state.running = false;
  }
}

async function runPipelineOnce(context, workspaceFolder, output, progress) {
  const config = getConfig(workspaceFolder);
  const styleFilePath = getStyleFilePath(workspaceFolder);
  const plotScriptPath = resolveWorkspacePath(workspaceFolder, config.plotScript);
  const mainTexPath = resolveWorkspacePath(workspaceFolder, config.mainTexFile);

  await ensureStyleFileExists(context, styleFilePath, output);
  await ensureFileExists(plotScriptPath, `Plot script not found: ${plotScriptPath}`);
  await ensureFileExists(mainTexPath, `Main TeX file not found: ${mainTexPath}`);

  progress.report({ message: "Running Python plot script..." });
  await runPlotStep(workspaceFolder, config, plotScriptPath, styleFilePath, output);

  progress.report({ message: "Compiling LaTeX..." });
  await runLatexStep(config, mainTexPath, output);
}

async function runPlotStep(workspaceFolder, config, plotScriptPath, styleFilePath, output) {
  const stateRoot = path.join(workspaceFolder.uri.fsPath, ".fontbigger");
  const mplConfigDir = path.join(stateRoot, ".mplconfig");
  const cacheDir = path.join(stateRoot, ".cache");
  const configDir = path.join(stateRoot, ".config");
  await fs.promises.mkdir(mplConfigDir, { recursive: true });
  await fs.promises.mkdir(cacheDir, { recursive: true });
  await fs.promises.mkdir(configDir, { recursive: true });

  output.appendLine("");
  output.appendLine(`[${timestamp()}] Python step`);
  output.appendLine(`> ${config.pythonCommand} ${plotScriptPath} --style ${styleFilePath}`);

  await runProcess(
    config.pythonCommand,
    [plotScriptPath, "--style", styleFilePath],
    {
      cwd: workspaceFolder.uri.fsPath,
      env: {
        ...process.env,
        MPLCONFIGDIR: mplConfigDir,
        XDG_CACHE_HOME: cacheDir,
        XDG_CONFIG_HOME: configDir
      }
    },
    output
  );
}

async function runLatexStep(config, mainTexPath, output) {
  const workingDirectory = path.dirname(mainTexPath);
  const customLatexCommand = config.latexCommand.trim();
  const latexEnv = buildExecutionEnv(getTeXPathCandidates());

  output.appendLine("");
  output.appendLine(`[${timestamp()}] LaTeX step`);

  if (customLatexCommand) {
    output.appendLine(`> ${customLatexCommand}`);
    await runShellCommand(customLatexCommand, workingDirectory, output, latexEnv);
    return;
  }

  const latexmkExecutable = await resolveExecutable("latexmk", getLatexmkCandidates());
  if (!latexmkExecutable) {
    throw new Error(
      "latexmk was not found. Set fontBigger.latexCommand or install TeX so latexmk is available."
    );
  }

  const args = [
    "-pdf",
    "-interaction=nonstopmode",
    "-synctex=1",
    "-file-line-error",
    path.basename(mainTexPath)
  ];

  output.appendLine(`> ${latexmkExecutable} ${args.map(quoteShell).join(" ")}`);
  await runProcess(
    latexmkExecutable,
    args,
    {
      cwd: workingDirectory,
      env: latexEnv
    },
    output
  );
}

function getConfig(workspaceFolder) {
  const config = vscode.workspace.getConfiguration("fontBigger", workspaceFolder.uri);
  return {
    styleFile: config.get("styleFile", ".fontbigger/figure_style.json"),
    registryFile: config.get("registryFile", ".fontbigger/figures.json"),
    plotScript: config.get("plotScript", "scripts/plot_demo.py"),
    mainTexFile: config.get("mainTexFile", "main.tex"),
    pythonCommand: config.get("pythonCommand", "python3"),
    latexCommand: config.get("latexCommand", ""),
    runOnSave: config.get("runOnSave", true)
  };
}

function getStyleFilePath(workspaceFolder) {
  const config = getConfig(workspaceFolder);
  return resolveWorkspacePath(workspaceFolder, config.styleFile);
}

function getRegistryFilePath(workspaceFolder) {
  const config = getConfig(workspaceFolder);
  return resolveWorkspacePath(workspaceFolder, config.registryFile);
}

function getActiveWorkspaceFolder() {
  const activeUri = vscode.window.activeTextEditor?.document?.uri;
  if (activeUri) {
    const activeWorkspaceFolder = vscode.workspace.getWorkspaceFolder(activeUri);
    if (activeWorkspaceFolder) {
      return activeWorkspaceFolder;
    }
  }

  return vscode.workspace.workspaceFolders?.[0];
}

function resolveWorkspacePath(workspaceFolder, relativePath) {
  return path.resolve(workspaceFolder.uri.fsPath, relativePath);
}

async function ensureStyleFileExists(context, styleFilePath, output) {
  if (await pathExists(styleFilePath)) {
    return false;
  }

  await fs.promises.mkdir(path.dirname(styleFilePath), { recursive: true });
  const templatePath = path.join(context.extensionPath, "resources", "default-figure-style.json");
  const templateContent = await fs.promises.readFile(templatePath, "utf8");
  await fs.promises.writeFile(styleFilePath, templateContent, "utf8");
  output.appendLine(`[${timestamp()}] Created default style file at ${styleFilePath}`);
  return true;
}

async function ensureFigureRegistryExists(registryFilePath, output) {
  if (await pathExists(registryFilePath)) {
    return false;
  }

  await fs.promises.mkdir(path.dirname(registryFilePath), { recursive: true });
  await fs.promises.writeFile(registryFilePath, `${JSON.stringify({ figures: {} }, null, 2)}\n`, "utf8");
  output.appendLine(`[${timestamp()}] Created figure registry at ${registryFilePath}`);
  return true;
}

async function readFigureRegistry(workspaceFolder, output) {
  const registryFilePath = getRegistryFilePath(workspaceFolder);
  await ensureFigureRegistryExists(registryFilePath, output);
  const content = await fs.promises.readFile(registryFilePath, "utf8");
  const parsed = JSON.parse(content);
  if (!parsed.figures || typeof parsed.figures !== "object") {
    throw new Error(`Figure registry must contain a top-level "figures" object: ${registryFilePath}`);
  }
  return {
    filePath: registryFilePath,
    figures: parsed.figures
  };
}

async function openConfigForFigureUnderCursor(workspaceFolder, output) {
  const registry = await readFigureRegistry(workspaceFolder, output);
  const editor = vscode.window.activeTextEditor;
  let selectedFigure = null;

  if (editor && isTexDocument(editor.document)) {
    selectedFigure = await findFigureForEditorPosition(workspaceFolder, registry.figures, editor);
  }

  if (!selectedFigure) {
    selectedFigure = await pickFigureFromRegistry(workspaceFolder, registry.figures);
  }

  if (!selectedFigure) {
    return;
  }

  await activateFigure(workspaceFolder, selectedFigure.id, selectedFigure.entry);
  const styleFilePath = resolveWorkspacePath(workspaceFolder, selectedFigure.entry.style);
  const document = await vscode.workspace.openTextDocument(styleFilePath);
  await vscode.window.showTextDocument(document, {
    preview: false,
    viewColumn: vscode.ViewColumn.Beside
  });

  vscode.window.showInformationMessage(`Font Bigger: active figure is now "${selectedFigure.id}".`);
}

function isTexDocument(document) {
  return document.languageId === "latex" || document.uri.fsPath.endsWith(".tex");
}

async function findFigureForEditorPosition(workspaceFolder, figures, editor) {
  const block = getEnclosingFigureBlock(editor.document, editor.selection.active.line);
  if (!block) {
    return null;
  }

  const commentId = extractFontBiggerFigureId(block.lines);
  if (commentId && figures[commentId]) {
    return {
      id: commentId,
      entry: figures[commentId]
    };
  }

  const includeGraphicsPaths = extractIncludeGraphicsPaths(block.text);
  const labels = extractLabels(block.text);
  const matches = [];

  for (const [id, entry] of Object.entries(figures)) {
    if (commentId && id === commentId) {
      matches.push({ id, entry, reason: "comment-id" });
      continue;
    }

    if (matchesFigureOutputs(workspaceFolder, editor.document, entry, includeGraphicsPaths)) {
      matches.push({ id, entry, reason: "output" });
      continue;
    }

    if (matchesFigureLabels(id, entry, labels)) {
      matches.push({ id, entry, reason: "label" });
    }
  }

  if (matches.length === 0) {
    return null;
  }

  if (matches.length === 1) {
    return matches[0];
  }

  const picked = await vscode.window.showQuickPick(
    matches.map((match) => ({
      label: match.id,
      description: match.reason,
      match
    })),
    {
      placeHolder: "Multiple figures matched the current LaTeX block. Pick one."
    }
  );

  return picked?.match ?? null;
}

function getEnclosingFigureBlock(document, lineNumber) {
  let start = -1;
  for (let line = lineNumber; line >= 0; line -= 1) {
    const text = document.lineAt(line).text;
    if (/\\begin\{figure\*?\}/.test(text)) {
      start = line;
      break;
    }
  }

  if (start === -1) {
    return null;
  }

  while (start > 0) {
    const previousText = document.lineAt(start - 1).text;
    if (/^\s*%/.test(previousText) || /^\s*$/.test(previousText)) {
      start -= 1;
      continue;
    }
    break;
  }

  let end = -1;
  for (let line = lineNumber; line < document.lineCount; line += 1) {
    const text = document.lineAt(line).text;
    if (/\\end\{figure\*?\}/.test(text)) {
      end = line;
      break;
    }
  }

  if (end === -1) {
    return null;
  }

  const lines = [];
  for (let line = start; line <= end; line += 1) {
    lines.push(document.lineAt(line).text);
  }

  return {
    start,
    end,
    lines,
    text: lines.join("\n")
  };
}

function extractFontBiggerFigureId(lines) {
  for (const line of lines) {
    const match = line.match(/%\s*fontbigger:\s*([A-Za-z0-9._-]+)/i);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function extractIncludeGraphicsPaths(text) {
  const matches = [];
  const pattern = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let match = pattern.exec(text);
  while (match) {
    matches.push(match[1]);
    match = pattern.exec(text);
  }
  return matches;
}

function extractLabels(text) {
  const matches = [];
  const pattern = /\\label\{([^}]+)\}/g;
  let match = pattern.exec(text);
  while (match) {
    matches.push(match[1]);
    match = pattern.exec(text);
  }
  return matches;
}

function matchesFigureOutputs(workspaceFolder, document, entry, includeGraphicsPaths) {
  if (!Array.isArray(entry.outputs) || entry.outputs.length === 0) {
    return false;
  }

  const documentDirectory = path.dirname(document.uri.fsPath);
  const includeGraphicsKeys = new Set();

  for (const includePath of includeGraphicsPaths) {
    for (const key of buildDocumentAssetKeys(workspaceFolder.uri.fsPath, documentDirectory, includePath)) {
      includeGraphicsKeys.add(key);
    }
  }

  for (const outputPath of entry.outputs) {
    for (const key of buildRegistryAssetKeys(workspaceFolder.uri.fsPath, outputPath)) {
      if (includeGraphicsKeys.has(key)) {
        return true;
      }
    }
  }

  return false;
}

function matchesFigureLabels(id, entry, labels) {
  if (!labels.length) {
    return false;
  }

  const normalizedLabels = new Set(labels.map((label) => label.toLowerCase()));
  if (normalizedLabels.has(id.toLowerCase()) || normalizedLabels.has(`fig:${id}`.toLowerCase())) {
    return true;
  }

  if (Array.isArray(entry.labels)) {
    for (const label of entry.labels) {
      if (normalizedLabels.has(String(label).toLowerCase())) {
        return true;
      }
    }
  }

  return false;
}

function buildDocumentAssetKeys(workspaceRoot, documentDirectory, includePath) {
  const keys = new Set();
  const normalizedIncludePath = String(includePath).replace(/\\/g, "/");
  keys.add(normalizeAssetKey(path.resolve(documentDirectory, normalizedIncludePath)));
  keys.add(normalizeAssetKey(path.resolve(workspaceRoot, normalizedIncludePath)));
  return [...keys];
}

function buildRegistryAssetKeys(workspaceRoot, outputPath) {
  const normalizedOutputPath = String(outputPath).replace(/\\/g, "/");
  return [
    normalizeAssetKey(path.resolve(workspaceRoot, normalizedOutputPath)),
    normalizeAssetKey(path.resolve(workspaceRoot, `./${normalizedOutputPath}`))
  ];
}

function normalizeAssetKey(assetPath) {
  const normalized = path.normalize(assetPath);
  const withoutExtension = normalized.replace(/\.[^.]+$/, "");
  return process.platform === "win32" ? withoutExtension.toLowerCase() : withoutExtension;
}

async function pickFigureFromRegistry(workspaceFolder, figures) {
  const items = Object.entries(figures).map(([id, entry]) => ({
    label: id,
    description: entry.style || "",
    detail: entry.script || "",
    id,
    entry
  }));

  if (items.length === 0) {
    vscode.window.showWarningMessage(
      `Font Bigger: no figures are registered yet. Add entries in ${path.relative(workspaceFolder.uri.fsPath, getRegistryFilePath(workspaceFolder))}.`
    );
    return null;
  }

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "Pick a registered figure."
  });

  if (!picked) {
    return null;
  }

  return {
    id: picked.id,
    entry: picked.entry
  };
}

async function activateFigure(workspaceFolder, figureId, entry) {
  if (!entry.script || !entry.style) {
    throw new Error(`Figure "${figureId}" must define both "script" and "style" in the registry.`);
  }

  await updateWorkspaceConfiguration(
    workspaceFolder,
    resolveWorkspacePath(workspaceFolder, entry.script),
    resolveWorkspacePath(workspaceFolder, entry.style)
  );
}

async function createCompatibleCopy(context, workspaceFolder, output) {
  const selected = await vscode.window.showOpenDialog({
    canSelectMany: false,
    defaultUri: workspaceFolder.uri,
    filters: {
      Python: ["py"]
    },
    openLabel: "Create Font Bigger Compatible Copy"
  });

  if (!selected || selected.length === 0) {
    return;
  }

  const sourceScriptPath = selected[0].fsPath;
  if (!samePath(path.extname(sourceScriptPath), ".py")) {
    vscode.window.showErrorMessage("Font Bigger: select a Python script.");
    return;
  }

  const sourceScript = await fs.promises.readFile(sourceScriptPath, "utf8");
  const scriptDirectory = path.dirname(sourceScriptPath);
  const baseName = path.basename(sourceScriptPath, ".py");
  const compatibleScriptPath = path.join(scriptDirectory, `${baseName}_fontbigger.py`);
  const styleFilePath = path.join(workspaceFolder.uri.fsPath, ".fontbigger", `${baseName}_style.json`);

  if (await pathExists(compatibleScriptPath)) {
    const action = await vscode.window.showWarningMessage(
      `Font Bigger: ${path.relative(workspaceFolder.uri.fsPath, compatibleScriptPath)} already exists.`,
      "Overwrite",
      "Open Existing",
      "Cancel"
    );

    if (action === "Cancel" || !action) {
      return;
    }

    if (action === "Open Existing") {
      if (!(await pathExists(styleFilePath))) {
        await fs.promises.mkdir(path.dirname(styleFilePath), { recursive: true });
        await fs.promises.writeFile(styleFilePath, generateCompatibleStyleContent(baseName), "utf8");
      }
      await updateWorkspaceConfiguration(workspaceFolder, compatibleScriptPath, styleFilePath);
      await openGeneratedFiles(compatibleScriptPath, styleFilePath);
      return;
    }
  }

  await fs.promises.mkdir(path.dirname(styleFilePath), { recursive: true });

  if (!(await pathExists(styleFilePath))) {
    await fs.promises.writeFile(styleFilePath, generateCompatibleStyleContent(baseName), "utf8");
  }

  const compatibleSource = generateCompatibleCopySource(
    sourceScript,
    path.relative(workspaceFolder.uri.fsPath, sourceScriptPath),
    path.relative(workspaceFolder.uri.fsPath, styleFilePath)
  );

  await fs.promises.writeFile(compatibleScriptPath, compatibleSource, "utf8");
  await registerFigure(workspaceFolder, {
    id: baseName,
    script: path.relative(workspaceFolder.uri.fsPath, compatibleScriptPath),
    style: path.relative(workspaceFolder.uri.fsPath, styleFilePath),
    outputs: [],
    labels: [`fig:${baseName}`]
  }, output);
  await updateWorkspaceConfiguration(workspaceFolder, compatibleScriptPath, styleFilePath);
  await openGeneratedFiles(compatibleScriptPath, styleFilePath);

  output.appendLine(
    `[${timestamp()}] Generated compatible copy ${path.relative(workspaceFolder.uri.fsPath, compatibleScriptPath)}`
  );
  vscode.window.showInformationMessage(
    "Font Bigger: generated a compatible copy and switched this workspace to use it."
  );
}

async function registerFigure(workspaceFolder, figureEntry, output) {
  const registryFilePath = getRegistryFilePath(workspaceFolder);
  await ensureFigureRegistryExists(registryFilePath, output);
  const registry = JSON.parse(await fs.promises.readFile(registryFilePath, "utf8"));
  if (!registry.figures || typeof registry.figures !== "object") {
    registry.figures = {};
  }

  const existing = registry.figures[figureEntry.id] || {};
  registry.figures[figureEntry.id] = {
    ...existing,
    script: figureEntry.script,
    style: figureEntry.style,
    outputs: Array.isArray(existing.outputs) && existing.outputs.length > 0 ? existing.outputs : figureEntry.outputs,
    labels: Array.isArray(existing.labels) && existing.labels.length > 0 ? existing.labels : figureEntry.labels
  };

  await fs.promises.writeFile(registryFilePath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

function generateCompatibleCopySource(originalSource, sourceRelativePath, styleRelativePath) {
  const strippedSource = originalSource.replace(/^from __future__ import annotations\s*\n+/m, "");
  const transformedSource = applyCompatibilityTransforms(strippedSource);
  const scriptBaseName = sanitizeForPythonString(path.basename(sourceRelativePath, ".py"));

  return `from __future__ import annotations

import argparse
import copy
import json
import os
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from cycler import cycler
from matplotlib.axes import Axes
from matplotlib.figure import Figure

# FONTBIGGER_NOTE: generated from ${sourceRelativePath}
# FONTBIGGER_NOTE: this is a safe editable copy. Keep the original script unchanged.
# FONTBIGGER_TODO: search for remaining hardcoded fontsize/color/legend values and replace them with STYLE entries.

PROJECT_ROOT = Path(__file__).resolve().parents[1]
STATE_ROOT = PROJECT_ROOT / ".fontbigger"
STATE_ROOT.mkdir(parents=True, exist_ok=True)
MPLCONFIGDIR = STATE_ROOT / ".mplconfig"
XDG_CACHE_HOME = STATE_ROOT / ".cache"
XDG_CONFIG_HOME = STATE_ROOT / ".config"
MPLCONFIGDIR.mkdir(parents=True, exist_ok=True)
XDG_CACHE_HOME.mkdir(parents=True, exist_ok=True)
XDG_CONFIG_HOME.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(MPLCONFIGDIR))
os.environ.setdefault("XDG_CACHE_HOME", str(XDG_CACHE_HOME))
os.environ.setdefault("XDG_CONFIG_HOME", str(XDG_CONFIG_HOME))

DEFAULT_STYLE = {
    "canvas": {
        "figure_width": 6.8,
        "figure_height": 4.2,
        "dpi": 180,
        "figure_facecolor": "#F8FBFF",
        "axes_facecolor": "#FFFFFF",
        "savefig_facecolor": "#FFFFFF",
        "output_dir": "figures/${scriptBaseName}",
        "force_output_dir": True,
        "tight_layout": False
    },
    "text": {
        "font_family": "DejaVu Sans",
        "font_size": 16,
        "title_size": 20,
        "axis_label_size": 18,
        "tick_label_size": 14,
        "legend_font_size": 14,
        "title_text": "",
        "x_label_text": "",
        "y_label_text": "",
        "title_color": "#102A43",
        "label_color": "#243B53",
        "tick_color": "#334E68"
    },
    "axes": {
        "grid": True,
        "grid_axis": "both",
        "grid_color": "#BCCCDC",
        "grid_line_width": 1.0,
        "grid_alpha": 0.28,
        "spine_color": "#829AB1",
        "spine_line_width": 1.0,
        "x_min": 0.0,
        "x_max": 1.0,
        "y_min": 0.0,
        "y_max": 1.0
    },
    "lines": {
        "line_width": 2.6,
        "marker_size": 7,
        "line_alpha": 0.95
    },
    "legend": {
        "columns": 2,
        "location": "upper center",
        "frameon": False
    },
    "palette": {
        "series_colors": ["#0B6E4F", "#C84C09", "#3C91E6", "#7A306C", "#C5D86D", "#2E4057"]
    }
}


def deep_merge(base: dict, overrides: dict) -> None:
    for key, value in overrides.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            deep_merge(base[key], value)
        else:
            base[key] = value


def load_style(style_path: Path) -> dict:
    style = copy.deepcopy(DEFAULT_STYLE)
    with style_path.open("r", encoding="utf-8") as handle:
        deep_merge(style, json.load(handle))
    return style


def resolve_output_dir(style: dict) -> Path:
    output_dir = style["canvas"].get("output_dir", "figures/${scriptBaseName}")
    output_path = Path(output_dir)
    return output_path if output_path.is_absolute() else PROJECT_ROOT / output_path


def iter_axes(candidate):
    if isinstance(candidate, Axes):
        yield candidate
        return

    if hasattr(candidate, "flat"):
        for item in candidate.flat:
            yield from iter_axes(item)
        return

    if isinstance(candidate, (list, tuple)):
        for item in candidate:
            yield from iter_axes(item)


def style_axis(axis: Axes) -> None:
    canvas = STYLE["canvas"]
    axes = STYLE["axes"]
    axis.set_facecolor(canvas["axes_facecolor"])

    for spine in axis.spines.values():
        spine.set_color(axes["spine_color"])
        spine.set_linewidth(axes["spine_line_width"])

    if axes["grid"]:
        axis.grid(
            axis=axes["grid_axis"],
            color=axes["grid_color"],
            linewidth=axes["grid_line_width"],
            alpha=axes["grid_alpha"],
        )
        axis.set_axisbelow(True)


def style_figure(figure: Figure) -> Figure:
    figure.patch.set_facecolor(STYLE["canvas"]["figure_facecolor"])
    return figure


def rewrite_output_path(file_arg):
    if hasattr(file_arg, "write"):
        return file_arg

    file_path = Path(file_arg)
    output_dir = resolve_output_dir(STYLE)
    force_output_dir = STYLE["canvas"].get("force_output_dir", True)

    if force_output_dir:
        file_path = output_dir / file_path.name
    elif not file_path.is_absolute():
        if str(file_path.parent) == ".":
            file_path = output_dir / file_path.name
        else:
            file_path = PROJECT_ROOT / file_path

    file_path.parent.mkdir(parents=True, exist_ok=True)
    return file_path


def apply_fontbigger_style() -> None:
    canvas = STYLE["canvas"]
    text = STYLE["text"]
    axes = STYLE["axes"]
    lines = STYLE["lines"]
    legend = STYLE["legend"]
    palette = STYLE["palette"]

    plt.rcParams.update(
        {
            "font.family": text["font_family"],
            "font.size": text["font_size"],
            "axes.titlesize": text["title_size"],
            "axes.labelsize": text["axis_label_size"],
            "xtick.labelsize": text["tick_label_size"],
            "ytick.labelsize": text["tick_label_size"],
            "legend.fontsize": text["legend_font_size"],
            "axes.labelcolor": text["label_color"],
            "xtick.color": text["tick_color"],
            "ytick.color": text["tick_color"],
            "text.color": text["title_color"],
            "axes.titlecolor": text["title_color"],
            "figure.facecolor": canvas["figure_facecolor"],
            "axes.facecolor": canvas["axes_facecolor"],
            "savefig.facecolor": canvas["savefig_facecolor"],
            "savefig.dpi": canvas["dpi"],
            "axes.edgecolor": axes["spine_color"],
            "axes.linewidth": axes["spine_line_width"],
            "grid.color": axes["grid_color"],
            "grid.alpha": axes["grid_alpha"],
            "grid.linewidth": axes["grid_line_width"],
            "axes.grid": axes["grid"],
            "lines.linewidth": lines["line_width"],
            "lines.markersize": lines["marker_size"],
            "patch.linewidth": lines["line_width"],
        }
    )
    plt.rcParams["axes.prop_cycle"] = cycler(color=palette["series_colors"])


def patch_matplotlib_runtime() -> None:
    original_subplots = plt.subplots
    original_figure = plt.figure
    original_pyplot_savefig = plt.savefig
    original_figure_savefig = Figure.savefig
    original_add_subplot = Figure.add_subplot
    original_figure_subplots = Figure.subplots
    original_legend = Axes.legend

    def patched_subplots(*args, **kwargs):
        kwargs.setdefault("figsize", (STYLE["canvas"]["figure_width"], STYLE["canvas"]["figure_height"]))
        kwargs.setdefault("dpi", STYLE["canvas"]["dpi"])
        figure, axes_obj = original_subplots(*args, **kwargs)
        style_figure(figure)
        for axis in iter_axes(axes_obj):
            style_axis(axis)
        if STYLE["canvas"]["tight_layout"]:
            figure.tight_layout()
        return figure, axes_obj

    def patched_figure(*args, **kwargs):
        kwargs.setdefault("figsize", (STYLE["canvas"]["figure_width"], STYLE["canvas"]["figure_height"]))
        kwargs.setdefault("dpi", STYLE["canvas"]["dpi"])
        figure = original_figure(*args, **kwargs)
        style_figure(figure)
        return figure

    def patched_figure_savefig(self, fname, *args, **kwargs):
        kwargs.setdefault("facecolor", STYLE["canvas"]["savefig_facecolor"])
        target = rewrite_output_path(fname) if isinstance(fname, (str, os.PathLike)) else fname
        return original_figure_savefig(self, target, *args, **kwargs)

    def patched_pyplot_savefig(fname, *args, **kwargs):
        kwargs.setdefault("facecolor", STYLE["canvas"]["savefig_facecolor"])
        target = rewrite_output_path(fname) if isinstance(fname, (str, os.PathLike)) else fname
        return original_pyplot_savefig(target, *args, **kwargs)

    def patched_add_subplot(self, *args, **kwargs):
        axis = original_add_subplot(self, *args, **kwargs)
        style_axis(axis)
        return axis

    def patched_figure_subplots(self, *args, **kwargs):
        axes_obj = original_figure_subplots(self, *args, **kwargs)
        for axis in iter_axes(axes_obj):
            style_axis(axis)
        return axes_obj

    def patched_legend(self, *args, **kwargs):
        kwargs.setdefault("loc", STYLE["legend"]["location"])
        kwargs.setdefault("ncol", STYLE["legend"]["columns"])
        kwargs.setdefault("frameon", STYLE["legend"]["frameon"])
        return original_legend(self, *args, **kwargs)

    plt.subplots = patched_subplots
    plt.figure = patched_figure
    plt.savefig = patched_pyplot_savefig
    Figure.savefig = patched_figure_savefig
    Figure.add_subplot = patched_add_subplot
    Figure.subplots = patched_figure_subplots
    Axes.legend = patched_legend


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--style",
        type=Path,
        default=PROJECT_ROOT / "${sanitizeForPythonString(styleRelativePath)}",
        help="Path to the Font Bigger JSON style file."
    )
    return parser.parse_args()


ARGS = parse_args()
STYLE = load_style(ARGS.style.resolve())
apply_fontbigger_style()
patch_matplotlib_runtime()

# FONTBIGGER_TODO: these common substitutions are already wired:
# - default figsize / dpi / facecolor for new figures
# - rcParams for fonts, colors, grid, line width and color cycle
# - savefig redirection into STYLE["canvas"]["output_dir"]
# - common OUTPUT/SAVE/EXPORT path variables redirected into STYLE["canvas"]["output_dir"]

${transformedSource}
`;
}

function applyCompatibilityTransforms(source) {
  let result = source;

  result = result.replace(/^import matplotlib\s*$/gm, "");
  result = result.replace(/^matplotlib\.use\([^\n]+\)\s*$/gm, "");
  result = result.replace(/^import matplotlib\.pyplot as plt\s*$/gm, "");
  result = result.replace(/^from cycler import cycler\s*$/gm, "");
  result = replaceHardcodedOutputAssignments(result);
  result = result.replace(
    /^OUTPUT_DIR\s*=\s*Path\([^\n]+\)\s*$/m,
    'OUTPUT_DIR = resolve_output_dir(STYLE)'
  );
  result = result.replace(
    /figsize\s*=\s*\([^)]+\)/g,
    'figsize=(STYLE["canvas"]["figure_width"], STYLE["canvas"]["figure_height"])'
  );
  result = result.replace(/dpi\s*=\s*[^,\)\n]+/g, 'dpi=STYLE["canvas"]["dpi"]');
  result = result.replace(
    /fig\.patch\.set_facecolor\([^)]+\)/g,
    'fig.patch.set_facecolor(STYLE["canvas"]["figure_facecolor"])'
  );
  result = result.replace(
    /ax\.set_facecolor\([^)]+\)/g,
    'ax.set_facecolor(STYLE["canvas"]["axes_facecolor"])'
  );

  return result.trimStart();
}

function replaceHardcodedOutputAssignments(source) {
  let result = source;

  result = result.replace(
    /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*Path\((["'])(.*?)\2\)\s*$/gm,
    (match, variableName, _quote, rawPath) => rewriteOutputAssignment(variableName, rawPath) ?? match
  );

  result = result.replace(
    /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(["'])(.*?)\2\s*$/gm,
    (match, variableName, _quote, rawPath) => rewriteOutputAssignment(variableName, rawPath) ?? match
  );

  return result;
}

function rewriteOutputAssignment(variableName, rawPath) {
  if (!looksLikeManagedOutputVariable(variableName, rawPath)) {
    return null;
  }

  const normalizedPath = rawPath.replace(/\\/g, "/");
  const basename = path.posix.basename(normalizedPath);
  const isDirectory =
    /(DIR|DIRECTORY|FOLDER)$/i.test(variableName) ||
    (!path.posix.extname(normalizedPath) && /(OUTPUT|SAVE|EXPORT|RESULT)$/i.test(variableName));

  if (isDirectory) {
    return `${variableName} = resolve_output_dir(STYLE)`;
  }

  if (!basename || basename === "." || basename === "/") {
    return `${variableName} = resolve_output_dir(STYLE)`;
  }

  return `${variableName} = resolve_output_dir(STYLE) / "${sanitizeForPythonString(basename)}"`;
}

function looksLikeManagedOutputVariable(variableName, rawPath) {
  const upperName = variableName.toUpperCase();
  const normalizedPath = rawPath.replace(/\\/g, "/");
  const hasManagedKeyword = /(OUTPUT|SAVE|EXPORT|RESULT|FIGURE|PLOT|CHART|GRAPH|CSV|IMAGE)/.test(upperName);
  const hasOutputishExtension = /\.(png|pdf|svg|jpg|jpeg|eps|csv|tsv|txt)$/i.test(normalizedPath);
  const looksLikePath = normalizedPath.includes("/") || normalizedPath.includes("\\");

  return hasManagedKeyword && (looksLikePath || hasOutputishExtension);
}

function generateCompatibleStyleContent(baseName) {
  const style = {
    canvas: {
      figure_width: 6.8,
      figure_height: 4.2,
      dpi: 180,
      figure_facecolor: "#F8FBFF",
      axes_facecolor: "#FFFFFF",
      savefig_facecolor: "#FFFFFF",
      output_dir: `figures/${baseName}`,
      force_output_dir: true,
      tight_layout: false
    },
    text: {
      font_family: "DejaVu Sans",
      font_size: 16,
      title_size: 20,
      axis_label_size: 18,
      tick_label_size: 14,
      legend_font_size: 14,
      title_text: "",
      x_label_text: "",
      y_label_text: "",
      title_color: "#102A43",
      label_color: "#243B53",
      tick_color: "#334E68"
    },
    axes: {
      grid: true,
      grid_axis: "both",
      grid_color: "#BCCCDC",
      grid_line_width: 1,
      grid_alpha: 0.28,
      spine_color: "#829AB1",
      spine_line_width: 1,
      x_min: 0,
      x_max: 1,
      y_min: 0,
      y_max: 1
    },
    lines: {
      line_width: 2.6,
      marker_size: 7,
      line_alpha: 0.95
    },
    legend: {
      columns: 2,
      location: "upper center",
      frameon: false
    },
    palette: {
      series_colors: ["#0B6E4F", "#C84C09", "#3C91E6", "#7A306C", "#C5D86D", "#2E4057"]
    }
  };

  return `${JSON.stringify(style, null, 2)}\n`;
}

async function updateWorkspaceConfiguration(workspaceFolder, compatibleScriptPath, styleFilePath) {
  const config = vscode.workspace.getConfiguration("fontBigger", workspaceFolder.uri);
  await config.update(
    "plotScript",
    path.relative(workspaceFolder.uri.fsPath, compatibleScriptPath),
    vscode.ConfigurationTarget.WorkspaceFolder
  );
  await config.update(
    "styleFile",
    path.relative(workspaceFolder.uri.fsPath, styleFilePath),
    vscode.ConfigurationTarget.WorkspaceFolder
  );
}

async function openGeneratedFiles(scriptPath, stylePath) {
  const scriptDocument = await vscode.workspace.openTextDocument(scriptPath);
  await vscode.window.showTextDocument(scriptDocument, {
    preview: false,
    viewColumn: vscode.ViewColumn.Active
  });

  if (await pathExists(stylePath)) {
    const styleDocument = await vscode.workspace.openTextDocument(stylePath);
    await vscode.window.showTextDocument(styleDocument, {
      preview: false,
      viewColumn: vscode.ViewColumn.Beside
    });
  }
}

function sanitizeForPythonString(value) {
  return value.replace(/\\/g, "/").replace(/"/g, '\\"');
}

async function ensureFileExists(filePath, errorMessage) {
  if (!(await pathExists(filePath))) {
    throw new Error(errorMessage);
  }
}

async function pathExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function runProcess(command, args, options, output) {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args, options);

    child.stdout.on("data", (chunk) => {
      output.append(chunk.toString());
    });

    child.stderr.on("data", (chunk) => {
      output.append(chunk.toString());
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command exited with code ${code}.`));
    });
  });
}

function runShellCommand(command, cwd, output, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, {
      cwd,
      env,
      shell: true
    });

    child.stdout.on("data", (chunk) => {
      output.append(chunk.toString());
    });

    child.stderr.on("data", (chunk) => {
      output.append(chunk.toString());
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Shell command exited with code ${code}.`));
    });
  });
}

function samePath(left, right) {
  if (process.platform === "win32") {
    return path.normalize(left).toLowerCase() === path.normalize(right).toLowerCase();
  }

  return path.normalize(left) === path.normalize(right);
}

function quoteShell(value) {
  if (/^[A-Za-z0-9_./-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

function timestamp() {
  return new Date().toLocaleTimeString();
}

function buildExecutionEnv(extraPathEntries) {
  const env = { ...process.env };
  const existingPath = env.PATH || "";
  const mergedPathEntries = [...extraPathEntries, ...existingPath.split(path.delimiter).filter(Boolean)];
  const uniqueEntries = [];

  for (const entry of mergedPathEntries) {
    if (!entry || uniqueEntries.includes(entry)) {
      continue;
    }
    uniqueEntries.push(entry);
  }

  env.PATH = uniqueEntries.join(path.delimiter);
  return env;
}

async function resolveExecutable(commandName, extraCandidates) {
  const candidates = [...extraCandidates];
  const pathEntries = (process.env.PATH || "").split(path.delimiter).filter(Boolean);

  for (const directory of pathEntries) {
    candidates.push(path.join(directory, commandName));
  }

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getLatexmkCandidates() {
  if (process.platform === "darwin") {
    return [
      "/Library/TeX/texbin/latexmk",
      "/Library/Tex/Texbin/latexmk",
      "/usr/local/bin/latexmk",
      "/opt/homebrew/bin/latexmk"
    ];
  }

  if (process.platform === "win32") {
    return [];
  }

  return [
    "/usr/bin/latexmk",
    "/usr/local/bin/latexmk",
    "/snap/bin/latexmk"
  ];
}

function getTeXPathCandidates() {
  if (process.platform === "darwin") {
    return [
      "/Library/TeX/texbin",
      "/Library/Tex/Texbin",
      "/usr/local/bin",
      "/opt/homebrew/bin"
    ];
  }

  if (process.platform === "win32") {
    return [];
  }

  return [
    "/usr/bin",
    "/usr/local/bin",
    "/snap/bin"
  ];
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
