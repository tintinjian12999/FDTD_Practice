import csv
import json
from pathlib import Path
import subprocess

import numpy as np


ROOT = Path(__file__).parents[1]
EXECUTABLE = ROOT / "build" / "debug" / "fdtd1d.exe"


def run_cli(*arguments: object) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [EXECUTABLE, *(str(argument) for argument in arguments)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


def small_arguments(output: Path, time_steps: int = 20) -> tuple[object, ...]:
    return (
        "--grid-size",
        20,
        "--time-steps",
        time_steps,
        "--source-index",
        5,
        "--probe-index",
        10,
        "--snapshot-interval",
        5,
        "--output-dir",
        output,
    )


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8") as stream:
        reader = csv.DictReader(stream)
        return list(reader.fieldnames or []), list(reader)


def test_help_lists_documented_options() -> None:
    result = run_cli("--help")

    assert result.returncode == 0
    for option in (
        "--mode",
        "--scale",
        "--grid-size",
        "--time-steps",
        "--courant",
        "--dx",
        "--dt",
        "--source-index",
        "--probe-index",
        "--snapshot-interval",
        "--output-dir",
    ):
        assert option in result.stdout


def test_small_run_writes_deterministic_schemas(tmp_path: Path) -> None:
    output = tmp_path / "run"
    result = run_cli(*small_arguments(output))

    assert result.returncode == 0, result.stderr
    probe_header, probe_rows = read_csv(output / "probe.csv")
    snapshot_header, snapshot_rows = read_csv(output / "snapshots.csv")
    metadata = json.loads((output / "run.json").read_text(encoding="utf-8"))
    assert probe_header == ["time_step", "time", "ez"]
    assert snapshot_header == [
        "time_step",
        "time",
        "index",
        "position",
        "ez",
    ]
    assert len(probe_rows) == 20
    assert len(snapshot_rows) == 4 * 20
    assert metadata["schema_version"] == 1
    assert metadata["grid_size"] == 20


def test_snapshot_groups_contain_every_index(tmp_path: Path) -> None:
    output = tmp_path / "groups"
    assert run_cli(*small_arguments(output)).returncode == 0
    _, rows = read_csv(output / "snapshots.csv")

    groups: dict[int, list[int]] = {}
    for row in rows:
        groups.setdefault(int(row["time_step"]), []).append(int(row["index"]))
    assert sorted(groups) == [0, 5, 10, 15]
    assert all(indices == list(range(20)) for indices in groups.values())


def test_equal_courant_scales_produce_equal_probe(tmp_path: Path) -> None:
    normalized = tmp_path / "normalized"
    si = tmp_path / "si"
    common = small_arguments(normalized, time_steps=40)[:-2]
    result_normalized = run_cli(
        *common,
        "--courant",
        0.9,
        "--output-dir",
        normalized,
    )
    dt = 0.9 * 0.01 / 299792458.0
    result_si = run_cli(
        *common,
        "--scale",
        "si",
        "--dx",
        0.01,
        "--dt",
        dt,
        "--output-dir",
        si,
    )

    assert result_normalized.returncode == 0, result_normalized.stderr
    assert result_si.returncode == 0, result_si.stderr
    _, normalized_rows = read_csv(normalized / "probe.csv")
    _, si_rows = read_csv(si / "probe.csv")
    normalized_ez = np.array([float(row["ez"]) for row in normalized_rows])
    si_ez = np.array([float(row["ez"]) for row in si_rows])
    np.testing.assert_allclose(normalized_ez, si_ez, rtol=0.0, atol=1.0e-12)


def test_invalid_arguments_create_no_output(tmp_path: Path) -> None:
    cases = [
        ("--scale", "si", "--dx", 0.01),
        ("--scale", "normalized", "--dx", 0.01),
        ("--grid-size", 20, "--grid-size", 30),
        ("--scale", "si", "--dx", 0.01, "--dt", 1.0),
    ]
    for index, arguments in enumerate(cases):
        output = tmp_path / f"invalid-{index}"
        result = run_cli(*arguments, "--output-dir", output)
        assert result.returncode == 2
        assert not output.exists()


def test_repeated_run_replaces_previous_data(tmp_path: Path) -> None:
    output = tmp_path / "repeat"
    assert run_cli(*small_arguments(output, time_steps=20)).returncode == 0
    assert run_cli(*small_arguments(output, time_steps=10)).returncode == 0

    _, probe_rows = read_csv(output / "probe.csv")
    _, snapshot_rows = read_csv(output / "snapshots.csv")
    assert len(probe_rows) == 10
    assert len(snapshot_rows) == 2 * 20
