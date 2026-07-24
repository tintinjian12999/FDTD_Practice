from pathlib import Path
import subprocess

import numpy as np


ROOT = Path(__file__).parents[1]
EXECUTABLE = ROOT / "build" / "debug" / "book_1d_bare_bones.exe"


def test_book_program_reproduces_delayed_gaussian() -> None:
    result = subprocess.run(
        [EXECUTABLE],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    samples = np.fromstring(result.stdout, sep="\n")
    assert samples.size == 250
    assert np.all(np.isfinite(samples))
    assert int(np.argmax(samples)) == 80
    assert abs(float(samples[80]) - 1.0) <= 1.0e-12
