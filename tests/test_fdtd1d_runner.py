from dataclasses import replace
from pathlib import Path
import subprocess
import sys
import threading
import time

import pytest

from gui.fdtd1d_model import build_command, default_parameters, find_solver
from gui.fdtd1d_runner import RunResult, SimulationRunner


ROOT = Path(__file__).parents[1]


def test_runner_executes_real_small_solver(tmp_path: Path) -> None:
    output = tmp_path / "real-run"
    parameters = replace(
        default_parameters(ROOT),
        grid_size="20",
        time_steps="5",
        source_index="5",
        probe_index="10",
        snapshot_interval="2",
        output_directory=str(output),
    )
    command = build_command(find_solver(ROOT), parameters)

    result = SimulationRunner().run(command, cwd=ROOT)

    assert result == RunResult(0, "", "", False)
    assert all(
        (output / name).is_file()
        for name in ("run.json", "probe.csv", "snapshots.csv")
    )


def test_runner_captures_failure_and_returns_to_idle() -> None:
    runner = SimulationRunner()
    command = [
        sys.executable,
        "-c",
        "import sys; print('out'); print('err', file=sys.stderr); sys.exit(7)",
    ]

    result = runner.run(command)

    assert result.returncode == 7
    assert result.stdout.strip() == "out"
    assert result.stderr.strip() == "err"
    assert not result.cancelled
    assert not runner.running
    assert not runner.cancel()


def wait_until_running(runner: SimulationRunner) -> None:
    deadline = time.monotonic() + 5.0
    while not runner.running and time.monotonic() < deadline:
        time.sleep(0.01)
    assert runner.running


def test_runner_cancels_only_active_process_and_rejects_concurrency() -> None:
    runner = SimulationRunner()
    command = [
        sys.executable,
        "-c",
        "import time; print('started', flush=True); time.sleep(30)",
    ]
    result: list[RunResult] = []
    worker = threading.Thread(target=lambda: result.append(runner.run(command)))
    worker.start()
    wait_until_running(runner)

    with pytest.raises(RuntimeError):
        runner.run([sys.executable, "-c", "print('second')"])
    assert runner.cancel()
    worker.join(timeout=5.0)

    assert not worker.is_alive()
    assert len(result) == 1
    assert result[0].cancelled
    assert result[0].returncode != 0
    assert not runner.running


def test_runner_reports_missing_executable_without_stale_state() -> None:
    runner = SimulationRunner()

    with pytest.raises(OSError):
        runner.run(["definitely-missing-fdtd-executable.exe"])

    assert not runner.running


def test_pre_cancelled_run_never_starts_process(tmp_path: Path) -> None:
    runner = SimulationRunner()
    cancellation = threading.Event()
    cancellation.set()
    marker = tmp_path / "started.txt"
    command = [
        sys.executable,
        "-c",
        f"from pathlib import Path; Path({str(marker)!r}).touch()",
    ]

    result = runner.run(command, cancel_event=cancellation)

    assert result.cancelled
    assert result.returncode != 0
    assert not marker.exists()
    assert not runner.running


def test_communication_failure_terminates_and_reaps_child(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class BrokenProcess:
        returncode = None
        terminated = False
        waited = False

        def communicate(self) -> tuple[str, str]:
            raise RuntimeError("communication failed")

        def poll(self) -> None:
            return None

        def terminate(self) -> None:
            self.terminated = True

        def wait(self, timeout: float | None = None) -> int:
            self.waited = True
            self.returncode = -1
            return self.returncode

    process = BrokenProcess()
    monkeypatch.setattr(
        "gui.fdtd1d_runner.subprocess.Popen",
        lambda *args, **kwargs: process,
    )
    runner = SimulationRunner()

    with pytest.raises(RuntimeError, match="communication failed"):
        runner.run(["solver.exe"])

    assert process.terminated
    assert process.waited
    assert not runner.running
