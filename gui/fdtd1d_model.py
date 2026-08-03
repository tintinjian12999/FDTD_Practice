from __future__ import annotations

from dataclasses import dataclass
import math
from pathlib import Path
import re


C0 = 299_792_458.0
OUTPUT_NAMES = (
    "run.json",
    "probe.csv",
    "snapshots.csv",
    "probe.png",
    "snapshot_final.png",
    "field.gif",
)


@dataclass(frozen=True)
class SimulationParameters:
    source: str
    boundary: str
    scale: str
    grid_size: str
    time_steps: str
    courant: str
    dx: str
    dt: str
    source_index: str
    probe_index: str
    source_delay: str
    source_width: str
    source_amplitude: str
    snapshot_interval: str
    output_directory: str


def default_parameters(root: Path) -> SimulationParameters:
    return SimulationParameters(
        source="additive",
        boundary="mur1",
        scale="normalized",
        grid_size="200",
        time_steps="450",
        courant="1",
        dx="0.01",
        dt="3.33564095198152e-11",
        source_index="50",
        probe_index="100",
        source_delay="30",
        source_width="10",
        source_amplitude="1",
        snapshot_interval="10",
        output_directory=str(root / "output" / "fdtd1d-gui"),
    )


def _integer(text: str, name: str) -> int:
    if re.fullmatch(r"\+?\d+", text) is None:
        raise ValueError(f"{name} must be a decimal integer")
    return int(text)


def _number(text: str, name: str) -> float:
    if text != text.strip() or not text:
        raise ValueError(f"{name} must be numeric")
    try:
        value = float(text)
    except ValueError as error:
        raise ValueError(f"{name} must be numeric") from error
    if not math.isfinite(value):
        raise ValueError(f"{name} must be finite")
    return value


def _shape_values(
    parameters: SimulationParameters,
) -> tuple[int, int, int, int, int]:
    grid = _integer(parameters.grid_size, "grid size")
    steps = _integer(parameters.time_steps, "time steps")
    source = _integer(parameters.source_index, "source index")
    probe = _integer(parameters.probe_index, "probe index")
    interval = _integer(parameters.snapshot_interval, "snapshot interval")
    if grid < 5 or steps < 1 or interval < 1:
        raise ValueError("grid and step counts are outside their valid range")
    if source >= grid or probe >= grid:
        raise ValueError("source or probe index is outside the grid")
    return grid, steps, source, probe, interval


def _validate_source(
    parameters: SimulationParameters,
    grid: int,
    source: int,
) -> None:
    delay = _number(parameters.source_delay, "source delay")
    width = _number(parameters.source_width, "source width")
    _number(parameters.source_amplitude, "source amplitude")
    if delay < 0 or width <= 0:
        raise ValueError("source delay or width is outside its valid range")
    if not 2 <= source <= grid - 3:
        raise ValueError("source is too close to a boundary")


def _validate_scale(parameters: SimulationParameters) -> None:
    if parameters.scale == "normalized":
        courant = _number(parameters.courant, "Courant number")
    else:
        dx = _number(parameters.dx, "dx")
        dt = _number(parameters.dt, "dt")
        if dx <= 0 or dt <= 0:
            raise ValueError("SI dx and dt must be positive")
        courant = C0 * dt / dx
    if not 0 < courant <= 1:
        raise ValueError("Courant number must satisfy 0 < Sc <= 1")


def validate_parameters(parameters: SimulationParameters) -> None:
    if parameters.source not in {"hard", "additive"}:
        raise ValueError("source injection is invalid")
    if parameters.boundary not in {"pmc", "mur1"}:
        raise ValueError("boundary type is invalid")
    if parameters.scale not in {"normalized", "si"}:
        raise ValueError("scale is invalid")
    grid, _, source, _, _ = _shape_values(parameters)
    _validate_source(parameters, grid, source)
    _validate_scale(parameters)
    if (
        not parameters.output_directory
        or parameters.output_directory != parameters.output_directory.strip()
    ):
        raise ValueError("output directory must not be empty or padded")
    if len(parameters.output_directory) >= 260:
        raise ValueError("output directory must be shorter than MAX_PATH")


def _common_arguments(parameters: SimulationParameters) -> list[str]:
    return [
        "--source", parameters.source,
        "--boundary", parameters.boundary,
        "--scale", parameters.scale,
        "--grid-size", parameters.grid_size,
        "--time-steps", parameters.time_steps,
        "--source-index", parameters.source_index,
        "--probe-index", parameters.probe_index,
        "--source-delay", parameters.source_delay,
        "--source-width", parameters.source_width,
        "--source-amplitude", parameters.source_amplitude,
        "--snapshot-interval", parameters.snapshot_interval,
        "--output-dir", parameters.output_directory,
    ]


def build_command(
    executable: Path,
    parameters: SimulationParameters,
) -> list[str]:
    validate_parameters(parameters)
    command = [str(executable), *_common_arguments(parameters)]
    if parameters.scale == "normalized":
        command.extend(["--courant", parameters.courant])
    else:
        command.extend(["--dx", parameters.dx, "--dt", parameters.dt])
    return command


def find_solver(root: Path, override: Path | None = None) -> Path:
    candidates = (
        (override,)
        if override is not None
        else (
            root / "build" / "release" / "fdtd1d.exe",
            root / "build" / "debug" / "fdtd1d.exe",
        )
    )
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("fdtd1d.exe was not found; build the project first")


def recognized_outputs(directory: Path) -> tuple[Path, ...]:
    return tuple(
        path
        for name in OUTPUT_NAMES
        if (path := directory / name).is_file()
    )
