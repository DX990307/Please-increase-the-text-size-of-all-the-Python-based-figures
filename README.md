# Please Increase the Text Size of All the Python-Based Figures

A VS Code extension prototype for LaTeX paper writing.

The core idea is straightforward: edit the Python figure script directly, save it, regenerate the figure, rebuild the PDF, and inspect the final paper layout inside VS Code.

This repository currently includes:

- a VS Code extension prototype
- automatic Python figure regeneration
- automatic `latexmk` rebuilds
- a multi-figure registry
- a minimal LaTeX paper sample
- a compatibility workflow for adapting existing matplotlib scripts

## Workflow

Recommended layout in VS Code:

- left: `main.tex`
- top-right: PDF preview via `LaTeX Workshop`
- bottom-right: the active Python figure script

After you save the active figure script, the extension automatically:

1. runs the current plotting script
2. regenerates the figure output
3. rebuilds the LaTeX PDF
4. lets you inspect the final typeset result immediately

## Why Script-First

This prototype no longer treats a separate JSON config file as the main editing surface.

Instead:

- the Python script is the source of truth
- generated compatible copies keep editable styling parameters near the top of the script
- the extension focuses on selecting the right figure script, rerunning it, and rebuilding the paper

That makes the workflow simpler when you are already comfortable editing Python and do not want to maintain an extra configuration layer.

## Repository Layout

```text
.
├── .vscode/
│   └── launch.json
├── examples/
│   └── minimal-paper/
│       ├── .fontbigger/
│       │   └── figures.json
│       ├── .vscode/
│       │   └── settings.json
│       ├── figures/
│       ├── scripts/
│       │   ├── plot_demo.py
│       │   ├── plot_prefetcher_sensitivity_bar_chart.py
│       │   └── plot_prefetcher_sensitivity_bar_chart_fontbigger.py
│       └── main.tex
├── src/
│   └── extension.js
└── package.json
```

## Quick Start

### 1. Prerequisites

You should have:

- VS Code
- Python 3
- `matplotlib`
- `latexmk`
- the VS Code extension `LaTeX Workshop`

On macOS, the sample workspace already includes [settings.json](examples/minimal-paper/.vscode/settings.json), which points `LaTeX Workshop` to `/Library/TeX/texbin`.

### 2. Launch the Extension Development Host

Open this repository in VS Code and press `F5`.

This starts an Extension Development Host and opens:

- [examples/minimal-paper](examples/minimal-paper)

### 3. Open the Sample Paper

In the development host:

1. open [examples/minimal-paper/main.tex](examples/minimal-paper/main.tex)
2. open the PDF preview with `LaTeX Workshop`
3. place the cursor inside a LaTeX `figure` block
4. run `Font Bigger: Open Figure Script In VS Code`
5. edit the opened Python script and save

### 4. Observe the Update Loop

After saving the active script, the extension will:

- run the active Python plotting script
- rewrite the figure outputs
- rebuild [examples/minimal-paper/main.tex](examples/minimal-paper/main.tex)

## Main Commands

- `Font Bigger: Open Active Figure Script`
  Opens the currently active plotting script.

- `Font Bigger: Open Figure Script In VS Code`
  Resolves the current LaTeX figure against the figure registry, switches the active figure, and opens the matching script.

- `Font Bigger: Run Figure + LaTeX Pipeline`
  Runs one manual regenerate-and-rebuild cycle.

- `Font Bigger: Create Compatible Copy From Existing Script`
  Creates a `*_fontbigger.py` compatible copy from an existing Python plotting script and registers it.

- `Font Bigger: Open Figure Registry`
  Opens the multi-figure registry file.

## Multi-Figure Workflow

The prototype uses a figure registry:

- [examples/minimal-paper/.fontbigger/figures.json](examples/minimal-paper/.fontbigger/figures.json)

Each figure entry can define:

- `script`
- `outputs`
- `labels`

Example:

```json
{
  "figures": {
    "demo": {
      "script": "scripts/plot_demo.py",
      "outputs": ["figures/output.pdf"],
      "labels": ["fig:demo"]
    }
  }
}
```

To make lookup reliable, add a marker above each LaTeX figure:

```tex
% fontbigger: demo
\begin{figure}
  \centering
  \includegraphics{figures/output.pdf}
  \caption{...}
  \label{fig:demo}
\end{figure}
```

Then place the cursor inside that figure and run:

- `Font Bigger: Open Figure Script In VS Code`

Resolution order is:

1. `% fontbigger: <id>`
2. `\includegraphics{...}` path matching
3. `\label{...}` matching
4. manual quick-pick fallback

## Adapting Existing Scripts

The extension does not rewrite arbitrary user scripts in place.

Instead, it creates a compatible copy:

- keeps the original script untouched
- creates a `*_fontbigger.py` editable copy
- registers the new figure in the registry
- switches the workspace to use the new script

This workflow is exposed through:

- `Font Bigger: Create Compatible Copy From Existing Script`

The generated compatible copy currently performs a broad first-pass adaptation:

- injects a script-local `STYLE` dictionary near the top of the file
- redirects output into a configurable output directory
- injects matplotlib runtime defaults for fonts, canvas size, grids, and color cycle
- rewrites common hardcoded output-path variables
- keeps `FONTBIGGER_TODO` comments for remaining manual cleanup

It is intentionally not positioned as a perfect converter for arbitrary matplotlib code.

## Included Example

This repository already contains a real adapted example:

- original script:
  [examples/minimal-paper/scripts/plot_prefetcher_sensitivity_bar_chart.py](examples/minimal-paper/scripts/plot_prefetcher_sensitivity_bar_chart.py)
- compatible copy:
  [examples/minimal-paper/scripts/plot_prefetcher_sensitivity_bar_chart_fontbigger.py](examples/minimal-paper/scripts/plot_prefetcher_sensitivity_bar_chart_fontbigger.py)

The sample paper already includes both:

- a direct sample figure driven by [plot_demo.py](examples/minimal-paper/scripts/plot_demo.py)
- a converted figure driven by [plot_prefetcher_sensitivity_bar_chart_fontbigger.py](examples/minimal-paper/scripts/plot_prefetcher_sensitivity_bar_chart_fontbigger.py)

## Configuration

The extension namespace is `fontBigger`.

- `fontBigger.registryFile`
  Relative path to the figure registry
- `fontBigger.plotScript`
  Relative path to the active Python plotting script
- `fontBigger.mainTexFile`
  Relative path to the main TeX file
- `fontBigger.pythonCommand`
  Python executable, default `python3`
- `fontBigger.latexCommand`
  Optional explicit LaTeX command. If empty, the extension resolves and runs `latexmk`
- `fontBigger.compileBackend`
  One of `auto`, `direct`, `latex-workshop`, or `overleaf-workshop`
- `fontBigger.runOnSave`
  Whether saving the active script automatically triggers the pipeline

These settings are resource-scoped so the extension can switch the active figure inside a workspace folder.

## Using With Overleaf Workshop

The intended integration path is:

1. open the Overleaf project locally with `Overleaf Workshop`
2. keep editing figure scripts locally with `Font Bigger`
3. let `Font Bigger` trigger the compile step through `Overleaf Workshop`
4. let `Overleaf Workshop` handle synchronization back to Overleaf

Recommended workspace settings for an Overleaf local replica:

```json
{
  "fontBigger.compileBackend": "overleaf-workshop",
  "fontBigger.mainTexFile": "main.tex"
}
```

Notes:

- `auto` prefers `LaTeX Workshop` when both extensions are installed
- for Overleaf local replicas, set `fontBigger.compileBackend` explicitly to `overleaf-workshop`
- if you want to bypass editor integrations entirely, use `direct`

## Current Limits

This is still a prototype. Current limits are deliberate:

- no clickable PDF object detection
- no automatic PDF coordinate-to-figure mapping
- no claim of fully automatic adaptation for arbitrary Python plotting scripts
- no GUI control panel yet
- matplotlib-focused, not a general plotting backend manager

## Near-Term Direction

Likely next steps:

- stronger automatic replacement for hardcoded fontsize, color, and legend arguments
- better registry editing and figure discovery UX
- presets such as `paper`, `rebuttal`, and `presentation`
- clearer diagnostics
- better coexistence with real project structures and Overleaf-style workflows
