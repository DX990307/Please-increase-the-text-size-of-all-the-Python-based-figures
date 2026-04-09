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
  const latexCommand = config.latexCommand.trim() || `latexmk -pdf -interaction=nonstopmode -synctex=1 ${quoteShell(path.basename(mainTexPath))}`;

  output.appendLine("");
  output.appendLine(`[${timestamp()}] LaTeX step`);
  output.appendLine(`> ${latexCommand}`);

  await runShellCommand(latexCommand, workingDirectory, output);
}

function getConfig(workspaceFolder) {
  const config = vscode.workspace.getConfiguration("fontBigger", workspaceFolder.uri);
  return {
    styleFile: config.get("styleFile", ".fontbigger/figure_style.json"),
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

function runShellCommand(command, cwd, output) {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, {
      cwd,
      env: process.env,
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

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
