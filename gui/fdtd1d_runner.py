from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import subprocess
import threading


@dataclass(frozen=True)
class RunResult:
    returncode: int
    stdout: str
    stderr: str
    cancelled: bool


class SimulationRunner:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._process: subprocess.Popen[str] | None = None
        self._cancel_requested = False

    @property
    def running(self) -> bool:
        with self._lock:
            return self._process is not None

    def _start(
        self,
        command: list[str],
        cwd: Path | None,
    ) -> subprocess.Popen[str]:
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        with self._lock:
            if self._process is not None:
                raise RuntimeError("a simulation is already running")
            self._cancel_requested = False
            process = subprocess.Popen(
                command,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                shell=False,
                creationflags=flags,
            )
            self._process = process
            return process

    def _release(self, process: subprocess.Popen[str]) -> bool:
        with self._lock:
            cancelled = self._cancel_requested
            if self._process is process:
                self._process = None
            return cancelled

    def run(
        self,
        command: list[str],
        cwd: Path | None = None,
    ) -> RunResult:
        process = self._start(command, cwd)
        try:
            stdout, stderr = process.communicate()
        finally:
            cancelled = self._release(process)
        return RunResult(
            returncode=process.returncode,
            stdout=stdout,
            stderr=stderr,
            cancelled=cancelled,
        )

    def cancel(self) -> bool:
        with self._lock:
            process = self._process
            if process is None or process.poll() is not None:
                return False
            self._cancel_requested = True
        try:
            process.terminate()
        except OSError:
            return False
        return True
