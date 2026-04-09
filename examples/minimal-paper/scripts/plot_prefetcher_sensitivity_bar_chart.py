from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


OUTPUT_DIR = Path("/Users/daoxuanxu/Documents/New project/ptw_bar_chart")

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

PALETTE = {
    "1 learner": "#ADDEEB",
    "2 learners": "#83CEE2",
    "3 learners": "#5ABED8",
    "4 learners": "#ED6612",
    "BaselineLine": "#F4C542",
}


def write_csv() -> None:
    output_path = OUTPUT_DIR / "learner_sensitivity_data.csv"
    headers = ["Benchmark", *SERIES.keys()]

    with output_path.open("w", encoding="utf-8", newline="") as handle:
        handle.write(",".join(headers) + "\n")
        for idx, benchmark in enumerate(BENCHMARKS):
            row = [benchmark] + [str(SERIES[label][idx]) for label in SERIES]
            handle.write(",".join(row) + "\n")


def plot_chart() -> None:
    x = np.arange(len(BENCHMARKS))
    width = 0.20
    offsets = np.array([-1.5, -0.5, 0.5, 1.5]) * width

    fig, ax = plt.subplots(figsize=(7.4, 3.8), dpi=220)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    ax.axhline(
        y=1.0,
        color=PALETTE["BaselineLine"],
        linewidth=2.0,
        linestyle="--",
        label="Baseline",
        zorder=5,
    )

    for offset, (label, values) in zip(offsets, SERIES.items()):
        ax.bar(
            x + offset,
            values,
            width=width,
            label=label,
            color=PALETTE[label],
            edgecolor="none",
            linewidth=0.0,
        )

    ax.set_xticks(x)
    ax.set_xticklabels(BENCHMARKS, fontsize=14, rotation=25, ha="center")
    ax.set_ylabel("Normalized Perf.", fontsize=16)
    ax.tick_params(axis="y", labelsize=14)
    ax.margins(x=0.01)
    ax.grid(axis="y", color="#D7D7D7", linewidth=1.0)
    ax.set_axisbelow(True)

    for spine in ax.spines.values():
        spine.set_color("#656667")
        spine.set_linewidth(1.0)

    handles, labels = ax.get_legend_handles_labels()
    order = ["Baseline", "4 learners", "1 learner", "2 learners", "3 learners"]
    ordered_handles = [handles[labels.index(label)] for label in order]

    legend = ax.legend(
        ordered_handles,
        order,
        ncol=3,
        frameon=False,
        loc="lower left",
        bbox_to_anchor=(0.0, 1.01, 1.0, 0.24),
        mode="expand",
        borderaxespad=0.0,
        columnspacing=1.6,
        handlelength=1.6,
        handletextpad=0.6,
        labelspacing=0.8,
        fontsize=13,
    )

    fig.tight_layout(rect=(0, 0, 1, 0.93))
    fig.savefig(OUTPUT_DIR / "learner_sensitivity_bar_chart.png", bbox_inches="tight")
    fig.savefig(OUTPUT_DIR / "learner_sensitivity_bar_chart.pdf", bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    write_csv()
    plot_chart()


if __name__ == "__main__":
    main()
