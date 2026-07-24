from pathlib import Path

import numpy as np
import pytest

from scripts.plot_signal import load_signal, plot_signal


def test_load_signal_reads_valid_csv(tmp_path: Path) -> None:
    csv_path = tmp_path / "signal.csv"
    csv_path.write_text("index,value\n0,0\n1,1\n", encoding="utf-8")

    indices, values = load_signal(csv_path)

    np.testing.assert_array_equal(indices, np.array([0.0, 1.0]))
    np.testing.assert_array_equal(values, np.array([0.0, 1.0]))


@pytest.mark.parametrize(
    ("content", "message"),
    [
        ("sample,amplitude\n0,1\n", "header"),
        ("index,value\n0,broken\n", "numeric"),
        ("index,value\n0,nan\n", "finite"),
        ("index,value\n0,1,extra\n", "columns"),
        ("index,value\n0\n", "columns"),
        ('"index,value\n0,1\n', "syntax"),
    ],
)
def test_load_signal_rejects_invalid_csv(
    tmp_path: Path, content: str, message: str
) -> None:
    csv_path = tmp_path / "invalid.csv"
    csv_path.write_text(content, encoding="utf-8")

    with pytest.raises(ValueError, match=message):
        load_signal(csv_path)


def test_load_signal_rejects_empty_data(tmp_path: Path) -> None:
    csv_path = tmp_path / "empty.csv"
    csv_path.write_text("index,value\n", encoding="utf-8")

    with pytest.raises(ValueError, match="no data"):
        load_signal(csv_path)


def test_plot_signal_creates_nonempty_png(tmp_path: Path) -> None:
    csv_path = tmp_path / "signal.csv"
    png_path = tmp_path / "signal.png"
    csv_path.write_text("index,value\n0,0\n1,1\n2,0\n", encoding="utf-8")

    plot_signal(csv_path, png_path)

    assert png_path.is_file()
    assert png_path.stat().st_size > 0
