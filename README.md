# Please Increase the Text Size of All the Python-Based Figures

A VS Code extension prototype for paper writing.

The goal is simple: when a figure looks too small after it is embedded into a LaTeX paper, you should be able to tweak figure styling, regenerate the figure, rebuild the PDF, and inspect the final typeset result without bouncing across tools.

This repository currently contains a working prototype with:

- a VS Code extension skeleton
- style-file-driven figure regeneration
- automatic `latexmk` rebuilds
- a minimal LaTeX paper sample
- multi-figure registry support
- a first-pass compatibility workflow for existing matplotlib scripts

## What It Does

Recommended layout in VS Code:

- left: `main.tex`
- top-right: PDF preview via `LaTeX Workshop`
- bottom-right: a `.fontbigger/*.json` style file

After you save the style file, the extension automatically:

1. runs the selected Python plotting script
2. regenerates the figure output
3. rebuilds the LaTeX PDF
4. lets you inspect the final paper layout immediately

## Current Repository Layout

```text
.
├── .vscode/
│   └── launch.json
├── examples/
│   └── minimal-paper/
│       ├── .fontbigger/
│       │   ├── figure_style.json
│       │   ├── figures.json
│       │   └── prefetcher_style.json
│       ├── .vscode/
│       │   └── settings.json
│       ├── figures/
│       ├── scripts/
│       │   ├── plot_demo.py
│       │   ├── plot_prefetcher_sensitivity_bar_chart.py
│       │   └── plot_prefetcher_sensitivity_bar_chart_fontbigger.py
│       └── main.tex
├── resources/
│   └── default-figure-style.json
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

On macOS, the sample workspace already includes [settings.json](examples/minimal-paper/.vscode/settings.json) that points `LaTeX Workshop` to `/Library/TeX/texbin`.

### 2. Launch the Extension Development Host

Open this repository in VS Code and press `F5`.

This starts an Extension Development Host and opens the sample workspace:

- [examples/minimal-paper](examples/minimal-paper)

### 3. Open the Sample Paper

In the development host:

1. open [examples/minimal-paper/main.tex](examples/minimal-paper/main.tex)
2. open the PDF preview with `LaTeX Workshop`
3. run `Font Bigger: Open Config For Figure Under Cursor` or `Font Bigger: Open Style File`
4. edit the style JSON and save

### 4. Observe the Update Loop

After saving a style file, the extension will:

- run the active Python script
- rewrite the figure outputs
- rebuild [examples/minimal-paper/main.tex](examples/minimal-paper/main.tex)

## Main Commands

- `Font Bigger: Open Style File`
  Opens the currently active style file. Creates it from a template if it does not exist.

- `Font Bigger: Run Figure + LaTeX Pipeline`
  Runs one manual regenerate-and-rebuild cycle.

- `Font Bigger: Create Default Style File`
  Creates the current style file from the default template.

- `Font Bigger: Create Compatible Copy From Existing Script`
  Generates a `*_fontbigger.py` compatible copy plus a matching style file from an existing Python plotting script.

- `Font Bigger: Open Figure Registry`
  Opens the multi-figure registry file.

- `Font Bigger: Open Config For Figure Under Cursor`
  Looks at the current LaTeX figure block, resolves the matching figure entry from the registry, switches the active script/style pair, and opens the matching config.

## Style File Format

Style files are grouped by category instead of being a flat list of keys.

- `canvas`
  Figure size, DPI, background, output directory
- `text`
  Fonts, labels, title text, text colors
- `axes`
  Grid, spines, ranges
- `lines`
  Line width, marker size, alpha
- `legend`
  Legend placement
- `series`
  Per-series labels, colors, markers
- `palette`
  Default color cycle for broader matplotlib compatibility

Example:

```json
{
  "canvas": {
    "figure_width": 7.2,
    "figure_height": 3.6,
    "output_dir": "figures/my-figure"
  },
  "text": {
    "title_text": "A Wider Figure With Softer Colors",
    "title_size": 24
  },
  "series": {
    "primary": {
      "color": "#005F73"
    },
    "secondary": {
      "color": "#BB3E03"
    }
  }
}
```

The default sample style lives at:

- [examples/minimal-paper/.fontbigger/figure_style.json](examples/minimal-paper/.fontbigger/figure_style.json)

## Multi-Figure Workflow

This prototype now includes a simple figure registry:

- [examples/minimal-paper/.fontbigger/figures.json](examples/minimal-paper/.fontbigger/figures.json)

Each figure entry can define:

- `script`
- `style`
- `outputs`
- `labels`

Example:

```json
{
  "figures": {
    "demo": {
      "script": "scripts/plot_demo.py",
      "style": ".fontbigger/figure_style.json",
      "outputs": ["figures/output.pdf"],
      "labels": ["fig:demo"]
    }
  }
}
```

To make figure resolution more reliable, add a lightweight marker above the LaTeX figure:

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

- `Font Bigger: Open Config For Figure Under Cursor`

The extension will:

1. inspect the current `figure` environment
2. try `% fontbigger: <id>` first
3. fall back to `\includegraphics{...}` and `\label{...}` matching
4. switch the active `plotScript` and `styleFile`
5. open the matched config

## Adapting Existing Scripts

The extension does not try to rewrite arbitrary user scripts in place.

Instead, it generates a compatible copy:

- keeps the original script unchanged
- creates a `*_fontbigger.py` editable copy
- creates a matching `.fontbigger/*_style.json`
- switches the workspace to use the new script/style pair
- registers the new figure in the figure registry

This workflow is exposed through:

- `Font Bigger: Create Compatible Copy From Existing Script`

The generated compatible copy currently does a broad first-pass adaptation:

- adds `--style`
- redirects output into a configurable directory
- injects matplotlib runtime defaults for fonts, canvas size, grids, and color cycle
- rewrites common hardcoded output-path variables
- keeps `FONTBIGGER_TODO` comments for remaining manual cleanup

It is intentionally not marketed as a perfect converter for arbitrary matplotlib code.

### Included Example

This repository already contains a real converted example:

- original script:
  [examples/minimal-paper/scripts/plot_prefetcher_sensitivity_bar_chart.py](examples/minimal-paper/scripts/plot_prefetcher_sensitivity_bar_chart.py)
- compatible copy:
  [examples/minimal-paper/scripts/plot_prefetcher_sensitivity_bar_chart_fontbigger.py](examples/minimal-paper/scripts/plot_prefetcher_sensitivity_bar_chart_fontbigger.py)
- matching style file:
  [examples/minimal-paper/.fontbigger/prefetcher_style.json](examples/minimal-paper/.fontbigger/prefetcher_style.json)

The sample paper already includes that figure as well:

- [examples/minimal-paper/main.tex](examples/minimal-paper/main.tex)

## Configuration

The extension namespace is `fontBigger`.

- `fontBigger.styleFile`
  Relative path to the active figure style file
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
- `fontBigger.runOnSave`
  Whether saving the active style file automatically triggers the pipeline

These settings are resource-scoped, so the extension can switch the active figure inside a workspace folder.

## Current Limits

This is still a prototype. Current limits are deliberate:

- no clickable PDF object detection
- no automatic PDF coordinate-to-figure mapping
- no claim of fully automatic adaptation for arbitrary Python plotting scripts
- no GUI control panel yet
- matplotlib-focused, not a general plotting backend manager

## Near-Term Direction

Likely next steps:

- stronger automatic replacement for hardcoded fontsize/color/legend arguments
- better registry editing and figure discovery UX
- presets such as `paper`, `rebuttal`, and `presentation`
- form-based editing instead of raw JSON
- clearer diagnostics
- better coexistence with real project structures and Overleaf-style workflows
