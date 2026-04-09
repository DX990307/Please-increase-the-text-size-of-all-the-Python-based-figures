from __future__ import annotations

import argparse
import copy
import json
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


DEFAULT_STYLE = {
    "canvas": {
        "figure_width": 6.8,
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

LEGACY_KEY_MAP = {
    "figure_width": ("canvas", "figure_width"),
    "figure_height": ("canvas", "figure_height"),
    "dpi": ("canvas", "dpi"),
    "figure_facecolor": ("canvas", "figure_facecolor"),
    "axes_facecolor": ("canvas", "axes_facecolor"),
    "font_family": ("text", "font_family"),
    "font_size": ("text", "font_size"),
    "title_size": ("text", "title_size"),
    "axis_label_size": ("text", "axis_label_size"),
    "tick_label_size": ("text", "tick_label_size"),
    "legend_font_size": ("text", "legend_font_size"),
    "title_text": ("text", "title_text"),
    "x_label_text": ("text", "x_label_text"),
    "y_label_text": ("text", "y_label_text"),
    "title_color": ("text", "title_color"),
    "label_color": ("text", "label_color"),
    "tick_color": ("text", "tick_color"),
    "grid_color": ("axes", "grid_color"),
    "grid_alpha": ("axes", "grid_alpha"),
    "spine_color": ("axes", "spine_color"),
    "x_min": ("axes", "x_min"),
    "x_max": ("axes", "x_max"),
    "y_min": ("axes", "y_min"),
    "y_max": ("axes", "y_max"),
    "line_width": ("lines", "line_width"),
    "marker_size": ("lines", "marker_size"),
    "line_alpha": ("lines", "line_alpha"),
    "legend_columns": ("legend", "columns"),
    "legend_location": ("legend", "location"),
    "series_primary_label": ("series", "primary", "label"),
    "series_secondary_label": ("series", "secondary", "label"),
    "series_primary_color": ("series", "primary", "color"),
    "series_secondary_color": ("series", "secondary", "color"),
    "series_primary_marker": ("series", "primary", "marker"),
    "series_secondary_marker": ("series", "secondary", "marker"),
}


def load_style(style_path: Path) -> dict:
    with style_path.open("r", encoding="utf-8") as handle:
        user_style = json.load(handle)
    style = copy.deepcopy(DEFAULT_STYLE)
    apply_legacy_overrides(style, user_style)
    deep_merge(style, user_style)
    return style


def apply_legacy_overrides(style: dict, user_style: dict) -> None:
    for old_key, path_parts in LEGACY_KEY_MAP.items():
        if old_key not in user_style:
            continue
        target = style
        for part in path_parts[:-1]:
            target = target[part]
        target[path_parts[-1]] = user_style[old_key]


def deep_merge(base: dict, overrides: dict) -> None:
    for key, value in overrides.items():
        if key in LEGACY_KEY_MAP:
            continue
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            deep_merge(base[key], value)
        else:
            base[key] = value


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--style",
        type=Path,
        default=PROJECT_ROOT / ".fontbigger" / "figure_style.json",
        help="Path to the JSON style file.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    style_path = args.style.resolve()
    output_dir = PROJECT_ROOT / "figures"

    style = load_style(style_path)
    build_plot(style, output_dir)
    print(f"Rendered figure with font_size={style['text']['font_size']} to {output_dir}")


if __name__ == "__main__":
    main()
