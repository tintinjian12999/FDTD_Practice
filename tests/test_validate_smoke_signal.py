from pathlib import Path

import numpy as np
import pytest

from scripts.validate_smoke_signal import validate_smoke_signal


def write_signal(path: Path, count: int = 128) -> None:
    indices = np.arange(count, dtype=float)
    values = np.sin(2.0 * np.pi * indices / 128.0)
    rows = ["index,value"]
    rows.extend(
        f"{int(index)},{value:.17g}"
        for index, value in zip(indices, values, strict=True)
    )
    path.write_text("\n".join(rows) + "\n", encoding="utf-8")


def test_validate_smoke_signal_accepts_expected_samples(tmp_path: Path) -> None:
    csv_path = tmp_path / "signal.csv"
    write_signal(csv_path)

    validate_smoke_signal(csv_path)


def test_validate_smoke_signal_rejects_wrong_count(tmp_path: Path) -> None:
    csv_path = tmp_path / "short.csv"
    write_signal(csv_path, count=127)

    with pytest.raises(ValueError, match="128"):
        validate_smoke_signal(csv_path)


def test_validate_smoke_signal_rejects_wrong_value(tmp_path: Path) -> None:
    csv_path = tmp_path / "corrupt.csv"
    write_signal(csv_path)
    content = csv_path.read_text(encoding="utf-8")
    csv_path.write_text(
        content.replace("64,1.2246467991473532e-16", "64,0.1"),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="sine"):
        validate_smoke_signal(csv_path)
