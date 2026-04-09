from __future__ import annotations

import argparse
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
    "figure_width": 6.8,
    "figure_height": 4.2,
    "dpi": 180,
    "font_family": "DejaVu Sans",
    "font_size": 16,
    "title_size": 20,
    "axis_label_size": 18,
    "tick_label_size": 14,
    "legend_font_size": 14,
    "line_width": 2.6,
    "marker_size": 7,
    "grid_alpha": 0.28,
}


def load_style(style_path: Path) -> dict:
    with style_path.open("r", encoding="utf-8") as handle:
        user_style = json.load(handle)
    return {**DEFAULT_STYLE, **user_style}


def build_plot(style: dict, output_dir: Path) -> None:
    plt.rcParams.update(
        {
            "font.family": style["font_family"],
            "font.size": style["font_size"],
            "axes.titlesize": style["title_size"],
            "axes.labelsize": style["axis_label_size"],
            "xtick.labelsize": style["tick_label_size"],
            "ytick.labelsize": style["tick_label_size"],
            "legend.fontsize": style["legend_font_size"],
            "axes.grid": True,
            "grid.alpha": style["grid_alpha"],
            "grid.linestyle": "--",
            "axes.spines.top": False,
            "axes.spines.right": False,
        }
    )

    x_values = [index / 10 for index in range(0, 63)]
    y_primary = [0.65 + 0.22 * math.sin(value) for value in x_values]
    y_secondary = [0.52 + 0.18 * math.cos(value + 0.35) for value in x_values]

    figure, axis = plt.subplots(
        figsize=(style["figure_width"], style["figure_height"]),
        constrained_layout=True,
    )
    axis.plot(
        x_values,
        y_primary,
        label="Readable baseline",
        linewidth=style["line_width"],
        marker="o",
        markevery=8,
        markersize=style["marker_size"],
        color="#0B6E4F",
    )
    axis.plot(
        x_values,
        y_secondary,
        label="Comparison curve",
        linewidth=style["line_width"],
        marker="s",
        markevery=8,
        markersize=style["marker_size"] - 1,
        color="#C84C09",
    )
    axis.set_title("Larger Text For Paper Figures")
    axis.set_xlabel("Normalized Time")
    axis.set_ylabel("Score")
    axis.set_xlim(min(x_values), max(x_values))
    axis.set_ylim(0.2, 1.0)
    axis.legend(frameon=False, ncol=2, loc="upper center")

    output_dir.mkdir(parents=True, exist_ok=True)
    figure.savefig(output_dir / "output.png", dpi=style["dpi"])
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
    print(f"Rendered figure with font_size={style['font_size']} to {output_dir}")


if __name__ == "__main__":
    main()
