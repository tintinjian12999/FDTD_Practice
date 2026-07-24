import csv
import json
from pathlib import Path

from PIL import Image
import pytest

from scripts.visualize_fdtd1d import load_run, visualize


METADATA = {
    "schema_version": 1,
    "mode": "additive-abc",
    "scale": "normalized",
    "grid_size": 5,
    "time_steps": 3,
    "courant": 1.0,
    "dx": 1.0,
    "dt": 1.0,
    "source_index": 2,
    "probe_index": 3,
    "source_delay": 1.0,
    "source_width": 1.0,
    "source_amplitude": 1.0,
    "snapshot_interval": 2,
    "time_unit": "normalized",
    "position_unit": "cells",
}


def write_csv(path: Path, header: list[str], rows: list[list[object]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(header)
        writer.writerows(rows)


def write_valid_run(directory: Path) -> None:
    directory.mkdir()
    (directory / "run.json").write_text(
        json.dumps(METADATA), encoding="utf-8"
    )
    write_csv(
        directory / "probe.csv",
        ["time_step", "time", "ez"],
        [[0, 0.0, 0.0], [1, 1.0, 0.5], [2, 2.0, 0.2]],
    )
    snapshot_rows = []
    for step in (0, 2):
        for index in range(5):
            snapshot_rows.append([step, float(step), index, index, index / 5])
    write_csv(
        directory / "snapshots.csv",
        ["time_step", "time", "index", "position", "ez"],
        snapshot_rows,
    )


def test_valid_run_creates_plots_and_animation(tmp_path: Path) -> None:
    directory = tmp_path / "valid"
    write_valid_run(directory)

    visualize(directory)

    outputs = [
        directory / "probe.png",
        directory / "snapshot_final.png",
        directory / "field.gif",
    ]
    assert all(path.stat().st_size > 0 for path in outputs)
    with Image.open(outputs[2]) as image:
        assert image.n_frames == 2


def invalid_case(directory: Path, case: str) -> None:
    if case == "header":
        path = directory / "probe.csv"
        path.write_text(
            path.read_text(encoding="utf-8").replace("time_step", "step", 1),
            encoding="utf-8",
        )
    elif case == "nan":
        path = directory / "probe.csv"
        path.write_text(
            path.read_text(encoding="utf-8").replace("1,1.0,0.5", "1,1,nan"),
            encoding="utf-8",
        )
    elif case == "duplicate":
        path = directory / "snapshots.csv"
        rows = path.read_text(encoding="utf-8").splitlines()
        rows[2] = rows[1]
        path.write_text("\n".join(rows) + "\n", encoding="utf-8")
    elif case == "missing":
        path = directory / "snapshots.csv"
        rows = path.read_text(encoding="utf-8").splitlines()
        path.write_text("\n".join(rows[:-1]) + "\n", encoding="utf-8")
    elif case == "time":
        path = directory / "probe.csv"
        path.write_text(
            path.read_text(encoding="utf-8").replace("2,2.0,0.2", "2,0,0.2"),
            encoding="utf-8",
        )
    elif case == "grid":
        metadata = dict(METADATA, grid_size=6)
        (directory / "run.json").write_text(
            json.dumps(metadata), encoding="utf-8"
        )
    elif case == "metadata":
        metadata = dict(METADATA, time_steps=4)
        (directory / "run.json").write_text(
            json.dumps(metadata), encoding="utf-8"
        )
    elif case == "units":
        metadata = dict(METADATA, position_unit="meters")
        (directory / "run.json").write_text(
            json.dumps(metadata), encoding="utf-8"
        )
    elif case == "scale-values":
        metadata = dict(METADATA, dt=0.5)
        (directory / "run.json").write_text(
            json.dumps(metadata), encoding="utf-8"
        )


@pytest.mark.parametrize(
    "case",
    [
        "header",
        "nan",
        "duplicate",
        "missing",
        "time",
        "grid",
        "metadata",
        "units",
        "scale-values",
    ],
)
def test_malformed_data_is_rejected(tmp_path: Path, case: str) -> None:
    directory = tmp_path / case
    write_valid_run(directory)
    invalid_case(directory, case)

    with pytest.raises(ValueError):
        load_run(directory)


def test_invalid_input_preserves_existing_images(tmp_path: Path) -> None:
    directory = tmp_path / "atomic"
    write_valid_run(directory)
    invalid_case(directory, "nan")
    outputs = [
        directory / "probe.png",
        directory / "snapshot_final.png",
        directory / "field.gif",
    ]
    for path in outputs:
        path.write_bytes(b"unchanged")

    with pytest.raises(ValueError):
        visualize(directory)

    assert all(path.read_bytes() == b"unchanged" for path in outputs)
