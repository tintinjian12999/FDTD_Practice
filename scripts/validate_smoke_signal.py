from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

from scripts.plot_signal import load_signal


def validate_smoke_signal(path: Path) -> None:
    indices, values = load_signal(path)
    expected_indices = np.arange(128, dtype=float)
    if indices.shape != expected_indices.shape:
        raise ValueError(
            f"Smoke signal must contain exactly 128 samples, got {indices.size}"
        )
    if not np.array_equal(indices, expected_indices):
        raise ValueError("Smoke signal indices must be the integers 0 through 127")

    expected_values = np.sin(2.0 * np.pi * expected_indices / 128.0)
    if not np.allclose(values, expected_values, rtol=0.0, atol=1.0e-12):
        maximum_error = float(np.max(np.abs(values - expected_values)))
        raise ValueError(
            f"Smoke signal does not match the expected sine wave: "
            f"maximum error={maximum_error:.17g}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate deterministic output from signal_writer."
    )
    parser.add_argument("input", type=Path)
    arguments = parser.parse_args()
    validate_smoke_signal(arguments.input)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
