from __future__ import annotations

import csv
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
import numpy as np


BENCHMARKS = [
    "AES",
    "BT",
    "FWT",
    "FFT",
    "FIR",
    "FWS",
    "I2C",
    "KM",
    "MM",
    "MT",
    "PR",
    "RELU",
    "SC",
    "SPMV",
    "GMEAN",
]

SERIES = {
    "1 learner": [
        1.10326017,
        3.3143557,
        3.30709679,
        4.71414024,
        1.80412013,
        1.09419681,
        1.5409444,
        0.91772209,
        1.35141398,
        1.04375252,
        1.01096491,
        2.70952602,
        2.57924843,
        1.008808,
        1.69380914,
    ],
    "2 learners": [
        1.10354753,
        3.3143557,
        3.30709679,
        4.71414024,
        1.81476898,
        1.09419681,
        1.55317925,
        2.05206902,
        1.35141398,
        1.04375252,
        1.0154185,
        3.95476232,
        2.56778774,
        1.008808,
        1.84498174,
    ],
    "3 learners": [
        1.10342482,
        3.3143557,
        3.30709679,
        4.71414024,
        1.81476898,
        1.09419681,
        1.55317925,
        2.05206902,
        1.35141398,
        1.04375252,
        1.02728258,
        3.95476232,
        2.56778774,
        1.008808,
        1.84649854,
    ],
    "4 learners": [
        1.04204,
        3.315478,
        3.314221,
        4.717952,
        1.81482,
        1.204014,
        1.59712083,
        2.055168,
        1.350796,
        1.04375252,
        1.00929,
        3.95407,
        2.568378,
        1.008808,
        1.86119787,
    ],
}


STYLE = {
    "canvas": {
        "figure_width": 7.4,
        "figure_height": 3.8,
        "dpi": 220,
        "figure_facecolor": "#FFFFFF",
        "axes_facecolor": "#FFFFFF",
        "output_dir": "figures/prefetcher",
        "output_basename": "learner_sensitivity_bar_chart",
    },
    "text": {
        "font_family": "DejaVu Sans",
        "font_size": 14,
        "axis_label_size": 16,
        "tick_label_size": 14,
        "legend_font_size": 13,
        "y_label_text": "Normalized Perf.",
        "x_tick_rotation": 25,
        "title_text": "",
        "title_size": 18,
        "label_color": "#222222",
        "tick_color": "#222222",
        "title_color": "#102A43",
    },
    "axes": {
        "grid_color": "#D7D7D7",
        "grid_line_width": 1.0,
        "grid_alpha": 1.0,
        "spine_color": "#656667",
        "spine_line_width": 1.0,
        "x_margin": 0.01,
        "baseline_y": 1.0,
        "baseline_color": "#F4C542",
        "baseline_line_width": 2.0,
        "baseline_line_style": "--",
        "y_min": 0.0,
        "y_max": 5.2,
    },
    "bars": {
        "bar_width": 0.20,
        "edgecolor": "none",
        "line_width": 0.0,
    },
    "legend": {
        "columns": 3,
        "location": "lower left",
        "bbox_to_anchor": [0.0, 1.01, 1.0, 0.24],
        "mode": "expand",
        "columnspacing": 1.6,
        "handlelength": 1.6,
        "handletextpad": 0.6,
        "labelspacing": 0.8,
        "borderaxespad": 0.0,
        "order": ["Baseline", "4 learners", "1 learner", "2 learners", "3 learners"],
    },
    "series": {
        "baseline": {
            "label": "Baseline",
            "color": "#F4C542",
        },
        "bars": {
            "1 learner": "#ADDEEB",
            "2 learners": "#83CEE2",
            "3 learners": "#5ABED8",
            "4 learners": "#ED6612",
        },
    },
}


def resolve_output_dir(style: dict) -> Path:
    output_dir = style["canvas"]["output_dir"]
    return Path(output_dir) if Path(output_dir).is_absolute() else PROJECT_ROOT / output_dir


def write_csv(output_dir: Path) -> None:
    output_path = output_dir / "learner_sensitivity_data.csv"
    headers = ["Benchmark", *SERIES.keys()]

    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(headers)
        for idx, benchmark in enumerate(BENCHMARKS):
            writer.writerow([benchmark, *[SERIES[label][idx] for label in SERIES]])


def plot_chart(style: dict, output_dir: Path) -> None:
    canvas = style["canvas"]
    text = style["text"]
    axes = style["axes"]
    bars = style["bars"]
    legend = style["legend"]
    series = style["series"]

    plt.rcParams.update(
        {
            "font.family": text["font_family"],
            "font.size": text["font_size"],
            "axes.labelsize": text["axis_label_size"],
            "xtick.labelsize": text["tick_label_size"],
            "ytick.labelsize": text["tick_label_size"],
            "legend.fontsize": text["legend_font_size"],
            "axes.labelcolor": text["label_color"],
            "xtick.color": text["tick_color"],
            "ytick.color": text["tick_color"],
            "axes.titlecolor": text["title_color"],
            "text.color": text["title_color"],
        }
    )

    x = np.arange(len(BENCHMARKS))
    width = bars["bar_width"]
    offsets = np.array([-1.5, -0.5, 0.5, 1.5]) * width

    fig, ax = plt.subplots(
        figsize=(canvas["figure_width"], canvas["figure_height"]),
        dpi=canvas["dpi"],
    )
    fig.patch.set_facecolor(canvas["figure_facecolor"])
    ax.set_facecolor(canvas["axes_facecolor"])

    ax.axhline(
        y=axes["baseline_y"],
        color=series["baseline"]["color"],
        linewidth=axes["baseline_line_width"],
        linestyle=axes["baseline_line_style"],
        label=series["baseline"]["label"],
        zorder=5,
    )

    for offset, (label, values) in zip(offsets, SERIES.items()):
        ax.bar(
            x + offset,
            values,
            width=width,
            label=label,
            color=series["bars"][label],
            edgecolor=bars["edgecolor"],
            linewidth=bars["line_width"],
        )

    ax.set_xticks(x)
    ax.set_xticklabels(BENCHMARKS, rotation=text["x_tick_rotation"], ha="center")
    ax.set_ylabel(text["y_label_text"])
    if text["title_text"]:
        ax.set_title(text["title_text"], fontsize=text["title_size"])
    ax.tick_params(axis="y", labelsize=text["tick_label_size"])
    ax.margins(x=axes["x_margin"])
    ax.grid(
        axis="y",
        color=axes["grid_color"],
        linewidth=axes["grid_line_width"],
        alpha=axes["grid_alpha"],
    )
    ax.set_axisbelow(True)
    ax.set_ylim(axes["y_min"], axes["y_max"])

    for spine in ax.spines.values():
        spine.set_color(axes["spine_color"])
        spine.set_linewidth(axes["spine_line_width"])

    handles, labels = ax.get_legend_handles_labels()
    ordered_handles = [handles[labels.index(label)] for label in legend["order"] if label in labels]

    ax.legend(
        ordered_handles,
        [label for label in legend["order"] if label in labels],
        ncol=legend["columns"],
        frameon=False,
        loc=legend["location"],
        bbox_to_anchor=tuple(legend["bbox_to_anchor"]),
        mode=legend["mode"],
        borderaxespad=legend["borderaxespad"],
        columnspacing=legend["columnspacing"],
        handlelength=legend["handlelength"],
        handletextpad=legend["handletextpad"],
        labelspacing=legend["labelspacing"],
        fontsize=text["legend_font_size"],
    )

    fig.tight_layout(rect=(0, 0, 1, 0.93))
    basename = canvas["output_basename"]
    fig.savefig(output_dir / f"{basename}.png", bbox_inches="tight")
    fig.savefig(output_dir / f"{basename}.pdf", bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    output_dir = resolve_output_dir(STYLE)
    output_dir.mkdir(parents=True, exist_ok=True)
    write_csv(output_dir)
    plot_chart(STYLE, output_dir)
    print(f"Rendered prefetcher figure to {output_dir}")


if __name__ == "__main__":
    main()
