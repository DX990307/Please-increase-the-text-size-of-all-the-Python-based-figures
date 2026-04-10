from __future__ import annotations

import math
import os
from pathlib import Path

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

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt


STYLE = {
    "canvas": {
        "figure_width": 4.8,
        "figure_height": 4.2,
        "dpi": 180,
        "figure_facecolor": "#F8FBFF",
        "axes_facecolor": "#FFFFFF",
    },
    "text": {
        "font_family": "DejaVu Sans",
        "font_size": 16,
        "title_size": 20,
        "axis_label_size": 18,
        "tick_label_size": 14,
        "legend_font_size": 14,
        "title_text": "Larger Text For Paper Figures",
        "x_label_text": "Normalized Time",
        "y_label_text": "Score",
        "title_color": "#102A43",
        "label_color": "#243B53",
        "tick_color": "#334E68",
    },
    "axes": {
        "grid_color": "#BCCCDC",
        "grid_alpha": 0.28,
        "spine_color": "#829AB1",
        "x_min": 0.0,
        "x_max": 6.2,
        "y_min": 0.2,
        "y_max": 1.0,
    },
    "lines": {
        "line_width": 2.6,
        "marker_size": 7,
        "line_alpha": 0.95,
    },
    "legend": {
        "columns": 2,
        "location": "upper center",
    },
    "series": {
        "primary": {
            "label": "Readable baseline",
            "color": "#0B6E4F",
            "marker": "o",
        },
        "secondary": {
            "label": "Comparison curve",
            "color": "#C84C09",
            "marker": "s",
        },
    },
}


def build_plot(style: dict, output_dir: Path) -> None:
    canvas = style["canvas"]
    text = style["text"]
    axes = style["axes"]
    lines = style["lines"]
    legend = style["legend"]
    series = style["series"]

    plt.rcParams.update(
        {
            "font.family": text["font_family"],
            "font.size": text["font_size"],
            "axes.titlesize": text["title_size"],
            "axes.labelsize": text["axis_label_size"],
            "xtick.labelsize": text["tick_label_size"],
            "ytick.labelsize": text["tick_label_size"],
            "legend.fontsize": text["legend_font_size"],
            "axes.grid": True,
            "grid.alpha": axes["grid_alpha"],
            "grid.linestyle": "--",
            "grid.color": axes["grid_color"],
            "axes.spines.top": False,
            "axes.spines.right": False,
            "axes.labelcolor": text["label_color"],
            "xtick.color": text["tick_color"],
            "ytick.color": text["tick_color"],
            "text.color": text["title_color"],
            "axes.titlecolor": text["title_color"],
        }
    )

    x_values = [index / 10 for index in range(0, 63)]
    y_primary = [0.65 + 0.22 * math.sin(value) for value in x_values]
    y_secondary = [0.52 + 0.18 * math.cos(value + 0.35) for value in x_values]

    figure, axis = plt.subplots(
        figsize=(canvas["figure_width"], canvas["figure_height"]),
        constrained_layout=True,
    )
    figure.patch.set_facecolor(canvas["figure_facecolor"])
    axis.set_facecolor(canvas["axes_facecolor"])
    axis.spines["left"].set_color(axes["spine_color"])
    axis.spines["bottom"].set_color(axes["spine_color"])
    axis.plot(
        x_values,
        y_primary,
        label=series["primary"]["label"],
        linewidth=lines["line_width"],
        marker=series["primary"]["marker"],
        markevery=8,
        markersize=lines["marker_size"],
        color=series["primary"]["color"],
        alpha=lines["line_alpha"],
    )
    axis.plot(
        x_values,
        y_secondary,
        label=series["secondary"]["label"],
        linewidth=lines["line_width"],
        marker=series["secondary"]["marker"],
        markevery=8,
        markersize=lines["marker_size"] - 1,
        color=series["secondary"]["color"],
        alpha=lines["line_alpha"],
    )
    axis.set_title(text["title_text"])
    axis.set_xlabel(text["x_label_text"])
    axis.set_ylabel(text["y_label_text"])
    axis.set_xlim(axes["x_min"], axes["x_max"])
    axis.set_ylim(axes["y_min"], axes["y_max"])
    axis.legend(
        frameon=False,
        ncol=legend["columns"],
        loc=legend["location"],
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    figure.savefig(output_dir / "output.png", dpi=canvas["dpi"])
    figure.savefig(output_dir / "output.pdf")
    plt.close(figure)


def main() -> None:
    output_dir = PROJECT_ROOT / "figures"
    build_plot(STYLE, output_dir)
    print(f"Rendered figure with font_size={STYLE['text']['font_size']} to {output_dir}")


if __name__ == "__main__":
    main()
