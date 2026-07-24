from dataclasses import replace
from pathlib import Path

import pytest

from gui.fdtd1d_model import (
    build_command,
    default_parameters,
    find_solver,
    recognized_outputs,
    validate_parameters,
)


ROOT = Path(__file__).parents[1]


def option_value(command: list[str], option: str) -> str:
    return command[command.index(option) + 1]


def test_defaults_build_normalized_command() -> None:
    parameters = default_parameters(ROOT)
    command = build_command(Path("fdtd1d.exe"), parameters)

    assert command[:5] == [
        "fdtd1d.exe",
        "--mode",
        "additive-abc",
        "--scale",
        "normalized",
    ]
    assert parameters.output_directory == str(ROOT / "output" / "fdtd1d-gui")
    assert option_value(command, "--courant") == "1"
    assert "--dx" not in command
    assert "--dt" not in command


def test_si_command_emits_only_si_scale_values() -> None:
    parameters = replace(
        default_parameters(ROOT),
        scale="si",
        courant="not-active",
    )
    command = build_command(Path("solver.exe"), parameters)

    assert option_value(command, "--dx") == "0.01"
    assert option_value(command, "--dt") == "3.33564095198152e-11"
    assert "--courant" not in command


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("mode", "unknown"),
        ("scale", "unknown"),
        ("grid_size", "4"),
        ("grid_size", "20.5"),
        ("time_steps", "0"),
        ("snapshot_interval", "0"),
        ("probe_index", "200"),
        ("source_index", "1"),
        ("source_delay", "-1"),
        ("source_width", "0"),
        ("source_amplitude", "nan"),
        ("courant", "0"),
        ("courant", "1.01"),
        ("courant", "inf"),
        ("output_directory", ""),
        ("output_directory", "x" * 260),
    ],
)
def test_invalid_normalized_parameters_are_rejected(
    field: str, value: str
) -> None:
    parameters = replace(default_parameters(ROOT), **{field: value})

    with pytest.raises(ValueError):
        validate_parameters(parameters)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("dx", "0"),
        ("dx", "nan"),
        ("dt", "0"),
        ("dt", "1"),
    ],
)
def test_invalid_si_parameters_are_rejected(field: str, value: str) -> None:
    parameters = replace(
        default_parameters(ROOT),
        scale="si",
        **{field: value},
    )

    with pytest.raises(ValueError):
        validate_parameters(parameters)


def test_inactive_scale_values_are_not_validated() -> None:
    normalized = replace(default_parameters(ROOT), dx="inactive", dt="inactive")
    si = replace(
        default_parameters(ROOT),
        scale="si",
        courant="inactive",
    )

    validate_parameters(normalized)
    validate_parameters(si)


def test_mode_specific_source_rules() -> None:
    hard = replace(
        default_parameters(ROOT),
        mode="hard-pmc",
        source_index="0",
    )
    validate_parameters(hard)

    with pytest.raises(ValueError):
        validate_parameters(replace(hard, source_index="1"))


def test_solver_discovery_precedence_and_override(tmp_path: Path) -> None:
    debug = tmp_path / "build" / "debug" / "fdtd1d.exe"
    release = tmp_path / "build" / "release" / "fdtd1d.exe"
    override = tmp_path / "custom.exe"
    for path in (debug, release, override):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.touch()

    assert find_solver(tmp_path) == release
    assert find_solver(tmp_path, override) == override


def test_solver_discovery_rejects_missing_files(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        find_solver(tmp_path)
    with pytest.raises(FileNotFoundError):
        find_solver(tmp_path, tmp_path / "missing.exe")


def test_recognized_outputs_are_existing_and_ordered(tmp_path: Path) -> None:
    for name in ("field.gif", "run.json", "unrelated.txt", "probe.csv"):
        (tmp_path / name).touch()

    assert recognized_outputs(tmp_path) == (
        tmp_path / "run.json",
        tmp_path / "probe.csv",
        tmp_path / "field.gif",
    )
