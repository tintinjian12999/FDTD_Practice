from __future__ import annotations

import csv
from dataclasses import dataclass
import json
import math
from pathlib import Path
import sys
from uuid import uuid4

import matplotlib

matplotlib.use("Agg")
from matplotlib import animation
from matplotlib import pyplot as plt
import numpy as np


METADATA_KEYS = {
    "schema_version", "mode", "scale", "grid_size", "time_steps",
    "courant", "dx", "dt", "source_index", "probe_index",
    "source_delay", "source_width", "source_amplitude",
    "snapshot_interval", "time_unit", "position_unit",
}
PROBE_HEADER = ["time_step", "time", "ez"]
SNAPSHOT_HEADER = ["time_step", "time", "index", "position", "ez"]


@dataclass(frozen=True)
class RunMetadata:
    schema_version: int
    mode: str
    scale: str
    grid_size: int
    time_steps: int
    courant: float
    dx: float
    dt: float
    source_index: int
    probe_index: int
    source_delay: float
    source_width: float
    source_amplitude: float
    snapshot_interval: int
    time_unit: str
    position_unit: str


@dataclass(frozen=True)
class ProbeData:
    time_step: np.ndarray
    time: np.ndarray
    ez: np.ndarray


@dataclass(frozen=True)
class SnapshotData:
    time_step: np.ndarray
    time: np.ndarray
    index: np.ndarray
    position: np.ndarray
    ez: np.ndarray


def _integer(value: object, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{name} must be an integer")
    return value


def _number(value: object, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be numeric")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"{name} must be finite")
    return result


def _text(value: object, name: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{name} must be nonempty text")
    return value


def _construct_metadata(raw: dict[str, object]) -> RunMetadata:
    return RunMetadata(
        _integer(raw["schema_version"], "schema_version"),
        _text(raw["mode"], "mode"),
        _text(raw["scale"], "scale"),
        _integer(raw["grid_size"], "grid_size"),
        _integer(raw["time_steps"], "time_steps"),
        _number(raw["courant"], "courant"),
        _number(raw["dx"], "dx"),
        _number(raw["dt"], "dt"),
        _integer(raw["source_index"], "source_index"),
        _integer(raw["probe_index"], "probe_index"),
        _number(raw["source_delay"], "source_delay"),
        _number(raw["source_width"], "source_width"),
        _number(raw["source_amplitude"], "source_amplitude"),
        _integer(raw["snapshot_interval"], "snapshot_interval"),
        _text(raw["time_unit"], "time_unit"),
        _text(raw["position_unit"], "position_unit"),
    )


def _validate_metadata(metadata: RunMetadata) -> None:
    if metadata.schema_version != 1:
        raise ValueError("unsupported metadata schema")
    if metadata.mode not in {"hard-pmc", "additive-abc"}:
        raise ValueError("invalid mode")
    if metadata.scale not in {"normalized", "si"}:
        raise ValueError("invalid scale")
    if metadata.grid_size < 1 or metadata.time_steps < 1:
        raise ValueError("grid and time dimensions must be positive")
    if metadata.snapshot_interval < 1:
        raise ValueError("snapshot interval must be positive")
    if not 0 < metadata.courant <= 1:
        raise ValueError("Courant number is outside (0, 1]")
    if metadata.dx <= 0 or metadata.dt <= 0:
        raise ValueError("dx and dt must be positive")
    if not 0 <= metadata.probe_index < metadata.grid_size:
        raise ValueError("probe index is outside the grid")


def _load_metadata(path: Path) -> RunMetadata:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"invalid metadata: {error}") from error
    if not isinstance(raw, dict) or set(raw) != METADATA_KEYS:
        raise ValueError("metadata keys do not match schema version 1")
    metadata = _construct_metadata(raw)
    _validate_metadata(metadata)
    return metadata


def _read_rows(path: Path, header: list[str]) -> list[list[str]]:
    try:
        with path.open(newline="", encoding="utf-8") as stream:
            reader = csv.reader(stream, strict=True)
            actual = next(reader, None)
            rows = list(reader)
    except (OSError, csv.Error) as error:
        raise ValueError(f"invalid CSV file {path.name}: {error}") from error
    if actual != header or any(len(row) != len(header) for row in rows):
        raise ValueError(f"{path.name} does not match its required schema")
    return rows


def _parse_int_column(rows: list[list[str]], column: int) -> np.ndarray:
    try:
        values = np.array([int(row[column]) for row in rows], dtype=np.int64)
    except (ValueError, OverflowError) as error:
        raise ValueError("invalid integer CSV value") from error
    return values


def _parse_float_column(rows: list[list[str]], column: int) -> np.ndarray:
    try:
        values = np.array([float(row[column]) for row in rows], dtype=float)
    except ValueError as error:
        raise ValueError("invalid floating-point CSV value") from error
    if not np.all(np.isfinite(values)):
        raise ValueError("CSV floating-point values must be finite")
    return values


def _load_probe(directory: Path, metadata: RunMetadata) -> ProbeData:
    rows = _read_rows(directory / "probe.csv", PROBE_HEADER)
    data = ProbeData(
        _parse_int_column(rows, 0),
        _parse_float_column(rows, 1),
        _parse_float_column(rows, 2),
    )
    expected_step = np.arange(metadata.time_steps, dtype=np.int64)
    expected_time = expected_step.astype(float) * metadata.dt
    if not np.array_equal(data.time_step, expected_step):
        raise ValueError("probe steps do not match metadata")
    if not np.allclose(data.time, expected_time, rtol=1e-12, atol=0.0):
        raise ValueError("probe times do not match metadata")
    return data


def _load_snapshots(directory: Path, metadata: RunMetadata) -> SnapshotData:
    rows = _read_rows(directory / "snapshots.csv", SNAPSHOT_HEADER)
    data = SnapshotData(
        _parse_int_column(rows, 0),
        _parse_float_column(rows, 1),
        _parse_int_column(rows, 2),
        _parse_float_column(rows, 3),
        _parse_float_column(rows, 4),
    )
    steps = np.arange(
        0, metadata.time_steps, metadata.snapshot_interval, dtype=np.int64
    )
    expected_step = np.repeat(steps, metadata.grid_size)
    expected_index = np.tile(
        np.arange(metadata.grid_size, dtype=np.int64), steps.size
    )
    expected_time = expected_step.astype(float) * metadata.dt
    expected_position = expected_index.astype(float) * metadata.dx
    if not np.array_equal(data.time_step, expected_step):
        raise ValueError("snapshot steps or group sizes do not match metadata")
    if not np.array_equal(data.index, expected_index):
        raise ValueError("snapshot indices are duplicated, missing, or unordered")
    if not np.allclose(data.time, expected_time, rtol=1e-12, atol=0.0):
        raise ValueError("snapshot times do not match metadata")
    if not np.allclose(
        data.position, expected_position, rtol=1e-12, atol=0.0
    ):
        raise ValueError("snapshot positions do not match metadata")
    return data


def load_run(
    directory: Path,
) -> tuple[RunMetadata, ProbeData, SnapshotData]:
    directory = Path(directory)
    metadata = _load_metadata(directory / "run.json")
    probe = _load_probe(directory, metadata)
    snapshots = _load_snapshots(directory, metadata)
    return metadata, probe, snapshots


def _render_probe(path: Path, metadata: RunMetadata, data: ProbeData) -> None:
    figure, axis = plt.subplots(figsize=(8, 4.5), constrained_layout=True)
    try:
        axis.plot(data.time, data.ez, color="#006699", linewidth=1.5)
        axis.set(
            title=f"1D FDTD probe at index {metadata.probe_index}",
            xlabel=f"Time ({metadata.time_unit})",
            ylabel="Ez",
        )
        axis.grid(True, alpha=0.25)
        figure.savefig(path, dpi=150)
    finally:
        plt.close(figure)


def _final_snapshot(data: SnapshotData) -> tuple[np.ndarray, np.ndarray, int]:
    final_step = int(data.time_step[-1])
    selection = data.time_step == final_step
    return data.position[selection], data.ez[selection], final_step


def _render_final(
    path: Path, metadata: RunMetadata, data: SnapshotData
) -> None:
    position, electric, step = _final_snapshot(data)
    figure, axis = plt.subplots(figsize=(8, 4.5), constrained_layout=True)
    try:
        axis.plot(position, electric, color="#b43c2c", linewidth=1.5)
        axis.set(
            title=f"Electric field at time step {step}",
            xlabel=f"Position ({metadata.position_unit})",
            ylabel="Ez",
        )
        axis.grid(True, alpha=0.25)
        figure.savefig(path, dpi=150)
    finally:
        plt.close(figure)


def _field_limits(electric: np.ndarray) -> tuple[float, float]:
    maximum = float(np.max(np.abs(electric)))
    span = maximum * 1.1 if maximum > 0 else 1.0
    return -span, span


def _render_animation(
    path: Path, metadata: RunMetadata, data: SnapshotData
) -> None:
    grid = metadata.grid_size
    frames = data.time_step.size // grid
    positions = data.position.reshape(frames, grid)
    electric = data.ez.reshape(frames, grid)
    steps = data.time_step.reshape(frames, grid)[:, 0]
    figure, axis = plt.subplots(figsize=(8, 4.5), constrained_layout=True)
    line, = axis.plot(positions[0], electric[0], color="#6b3fa0")
    title = axis.set_title("")
    axis.set(xlabel=f"Position ({metadata.position_unit})", ylabel="Ez")
    axis.set_ylim(*_field_limits(electric))
    axis.grid(True, alpha=0.25)

    def update(frame: int) -> tuple[object, ...]:
        line.set_data(positions[frame], electric[frame])
        title.set_text(f"Electric field at time step {steps[frame]}")
        return line, title

    try:
        movie = animation.FuncAnimation(
            figure, update, frames=frames, interval=100, blit=False
        )
        movie.save(path, writer=animation.PillowWriter(fps=10))
    finally:
        plt.close(figure)


def _temporary_path(destination: Path) -> Path:
    token = uuid4().hex
    return destination.with_name(
        f".{destination.stem}.{token}.tmp{destination.suffix}"
    )


def visualize(directory: Path) -> tuple[Path, Path, Path]:
    directory = Path(directory)
    metadata, probe, snapshots = load_run(directory)
    destinations = (
        directory / "probe.png",
        directory / "snapshot_final.png",
        directory / "field.gif",
    )
    temporary = tuple(_temporary_path(path) for path in destinations)
    try:
        _render_probe(temporary[0], metadata, probe)
        _render_final(temporary[1], metadata, snapshots)
        _render_animation(temporary[2], metadata, snapshots)
        for source, destination in zip(temporary, destinations, strict=True):
            source.replace(destination)
    finally:
        for path in temporary:
            path.unlink(missing_ok=True)
    return destinations


def main(arguments: list[str] | None = None) -> int:
    values = sys.argv[1:] if arguments is None else arguments
    if len(values) != 1:
        print("Usage: python -m scripts.visualize_fdtd1d OUTPUT_DIR", file=sys.stderr)
        return 2
    try:
        visualize(Path(values[0]))
    except ValueError as error:
        print(f"visualize_fdtd1d: {error}", file=sys.stderr)
        return 2
    except OSError as error:
        print(f"visualize_fdtd1d: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
