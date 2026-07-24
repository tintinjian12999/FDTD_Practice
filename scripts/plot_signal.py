from __future__ import annotations

import argparse
import csv
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
from matplotlib import pyplot as plt


def load_signal(path: Path) -> tuple[np.ndarray, np.ndarray]:
    if not path.is_file():
        raise ValueError(f"Signal file does not exist: {path}")

    indices: list[float] = []
    values: list[float] = []
    with path.open(newline="", encoding="utf-8") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != ["index", "value"]:
            raise ValueError("CSV header must be exactly: index,value")
        for row_number, row in enumerate(reader, start=2):
            try:
                index = float(row["index"])
                value = float(row["value"])
            except (KeyError, TypeError, ValueError) as error:
                raise ValueError(
                    f"Invalid numeric value on CSV row {row_number}"
                ) from error
            if not np.isfinite(index) or not np.isfinite(value):
                raise ValueError(f"CSV row {row_number} must contain finite values")
            indices.append(index)
            values.append(value)

    if not indices:
        raise ValueError("Signal CSV contains no data rows")
    return np.asarray(indices), np.asarray(values)


def plot_signal(input_path: Path, output_path: Path) -> None:
    indices, values = load_signal(input_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    figure, axis = plt.subplots(figsize=(8, 4.5), constrained_layout=True)
    axis.plot(indices, values, color="#005f73", linewidth=2)
    axis.set_xlabel("Sample index")
    axis.set_ylabel("Amplitude")
    axis.set_title("uFDTD environment smoke signal")
    axis.grid(True, alpha=0.3)
    figure.savefig(output_path, dpi=150)
    plt.close(figure)


def main() -> int:
    parser = argparse.ArgumentParser(description="Plot a uFDTD signal CSV.")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    arguments = parser.parse_args()
    plot_signal(arguments.input, arguments.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
