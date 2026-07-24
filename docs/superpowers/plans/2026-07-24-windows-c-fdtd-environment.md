# Native Windows C/FDTD Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a reproducible native Windows C environment for serial, pthread, Microsoft MPI, and Python-based FDTD post-processing work.

**Architecture:** A dedicated Conda environment supplies GCC, CMake, Ninja, MS-MPI, and Python tooling. CMake targets encapsulate compiler, pthread, and MPI differences, while CTest and Pytest provide executable proof that the environment works in Debug and Release configurations.

**Tech Stack:** Conda 25.9.1, conda-forge GCC 15.2, C17, CMake 4.4, Ninja 1.13, winpthreads, MS-MPI 10.1.1, Python 3.12, NumPy 2.5, Matplotlib 3.11, Pytest 9.

## Global Constraints

- The implementation must remain native to 64-bit Windows 11.
- Create or update only the Conda environment named `ufdtd-c`.
- Do not modify package contents in `base` or `cpp_env`.
- Use C17 and GCC 15.2 with `-Wall -Wextra -Wpedantic`.
- Use CMake and Ninja as the canonical build interface.
- Use `Threads::Threads` for pthread linking and `MPI::MPI_C` for MPI linking.
- Run the MPI smoke test with exactly four local processes and a 30-second timeout.
- Use an absolute numeric tolerance of `1e-12` for the math smoke test.
- Keep source-code comments in English.
- Keep `README.md` bilingual in Traditional Chinese and English.
- Keep `ufdtd.pdf`, build trees, and generated output untracked.
- Do not configure a Git remote, push, deploy, or modify Windows Firewall rules.

## File Structure

- Create `environment.yml`: reproducible Conda dependency declaration.
- Create `CMakeLists.txt`: project version, compiler policy, smoke targets, and CTest registration.
- Create `CMakePresets.json`: Debug and Release configure/build/test presets.
- Create `examples/smoke/math_smoke.c`: standard math verification.
- Create `examples/smoke/memory_smoke.c`: dynamic allocation verification.
- Create `examples/smoke/pthread_smoke.c`: two-worker pthread verification.
- Create `examples/smoke/mpi_smoke.c`: four-process MS-MPI verification.
- Create `examples/smoke/signal_writer.c`: deterministic CSV producer.
- Create `scripts/__init__.py`: import marker for Python tests.
- Create `scripts/plot_signal.py`: strict CSV parser and headless plotter.
- Create `tests/test_plot_signal.py`: parser and PNG behavior tests.
- Create `scripts/bootstrap.ps1`: idempotent environment creation/update and package-state protection.
- Create `scripts/verify.ps1`: full Debug, Release, CTest, Pytest, and plotting verification.
- Modify `README.md`: bilingual installation and verification instructions.
- Modify `CHANGELOG.md`: environment implementation record.

---

### Task 1: Reproducible Conda Declaration

**Files:**
- Create: `environment.yml`

**Interfaces:**
- Consumes: Miniconda executable resolved at `C:\Users\tim_chien\AppData\Local\miniconda3\Scripts\conda.exe`.
- Produces: Conda environment `ufdtd-c` with activated `CC`, GCC runtime, CMake, Ninja, MS-MPI, Python, NumPy, Matplotlib, and Pytest.

- [ ] **Step 1: Record protected environment package state**

Run:

```powershell
$conda = 'C:\Users\tim_chien\AppData\Local\miniconda3\Scripts\conda.exe'
& $conda list -n base --json | Set-Content -Encoding utf8 "$env:TEMP\ufdtd-base-before.json"
& $conda list -n cpp_env --json | Set-Content -Encoding utf8 "$env:TEMP\ufdtd-cpp-env-before.json"
```

Expected: both commands exit with code 0 and create non-empty JSON snapshots.

- [ ] **Step 2: Write the environment declaration**

Create `environment.yml`:

```yaml
name: ufdtd-c
channels:
  - conda-forge
  - nodefaults
dependencies:
  - gcc=15.2
  - gcc_win-64=15.2
  - cmake>=4.4,<5
  - ninja>=1.13,<2
  - msmpi=10.1.1
  - python=3.12
  - numpy>=2.5,<3
  - matplotlib>=3.11,<4
  - pytest>=9,<10
```

- [ ] **Step 3: Verify the solve before installation**

Run:

```powershell
& $conda env create --dry-run --file environment.yml
```

Expected: output includes `gcc_impl_win-64-15.2`, `libwinpthread`, `msmpi-10.1.1`, `cmake`, `ninja`, and `DryRunExit`.

- [ ] **Step 4: Create the environment**

Run:

```powershell
& $conda env create --file environment.yml
```

Expected: command exits with code 0 and `conda env list` includes `ufdtd-c`.

- [ ] **Step 5: Verify installed tool versions**

Run:

```powershell
& $conda run -n ufdtd-c gcc --version
& $conda run -n ufdtd-c cmake --version
& $conda run -n ufdtd-c ninja --version
& $conda run -n ufdtd-c python --version
& $conda run -n ufdtd-c mpiexec -help
```

Expected: GCC 15.2.x, CMake 4.4.x, Ninja 1.13.x, Python 3.12.x, and MS-MPI `mpiexec` help.

- [ ] **Step 6: Commit**

```powershell
git add environment.yml
git commit -m "build: declare Windows FDTD toolchain"
```

---

### Task 2: Serial C and CMake Smoke Harness

**Files:**
- Create: `CMakeLists.txt`
- Create: `CMakePresets.json`
- Create: `examples/smoke/math_smoke.c`
- Create: `examples/smoke/memory_smoke.c`
- Create: `examples/smoke/signal_writer.c`

**Interfaces:**
- Consumes: activated GCC/CMake/Ninja from `ufdtd-c`.
- Produces: `math_smoke`, `memory_smoke`, and `signal_writer` executable targets; CTest tests named identically.

- [ ] **Step 1: Write the smoke programs**

Create `examples/smoke/math_smoke.c`:

```c
#include <math.h>
#include <stdio.h>

int main(void)
{
    const double pi = acos(-1.0);
    const double actual = sin(pi / 2.0);
    const double error = fabs(actual - 1.0);

    if (error > 1.0e-12) {
        fprintf(stderr, "Math smoke failed: error=%.17g\n", error);
        return 1;
    }

    printf("Math smoke passed: error=%.17g\n", error);
    return 0;
}
```

Create `examples/smoke/memory_smoke.c`:

```c
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    const size_t count = 4096U;
    uint64_t *values = calloc(count, sizeof(*values));

    if (values == NULL) {
        fprintf(stderr, "Memory allocation failed for %zu elements.\n", count);
        return 1;
    }

    uint64_t sum = 0U;
    for (size_t index = 0U; index < count; ++index) {
        if (values[index] != 0U) {
            fprintf(stderr, "calloc did not zero element %zu.\n", index);
            free(values);
            return 1;
        }
        values[index] = (uint64_t)index;
        sum += values[index];
    }

    free(values);

    const uint64_t expected = ((uint64_t)count * (count - 1U)) / 2U;
    if (sum != expected) {
        fprintf(stderr, "Memory smoke sum mismatch.\n");
        return 1;
    }

    printf("Memory smoke passed: sum=%llu\n", (unsigned long long)sum);
    return 0;
}
```

Create `examples/smoke/signal_writer.c`:

```c
#include <errno.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

int main(int argc, char **argv)
{
    if (argc != 2) {
        fprintf(stderr, "Usage: signal_writer OUTPUT_CSV\n");
        return 2;
    }

    FILE *stream = fopen(argv[1], "w");
    if (stream == NULL) {
        fprintf(stderr, "Cannot open %s: %s\n", argv[1], strerror(errno));
        return 1;
    }

    if (fprintf(stream, "index,value\n") < 0) {
        fprintf(stderr, "Cannot write CSV header.\n");
        fclose(stream);
        return 1;
    }

    const double pi = acos(-1.0);
    for (int index = 0; index < 128; ++index) {
        const double value = sin(2.0 * pi * (double)index / 128.0);
        if (fprintf(stream, "%d,%.17g\n", index, value) < 0) {
            fprintf(stderr, "Cannot write CSV row %d.\n", index);
            fclose(stream);
            return 1;
        }
    }

    if (fclose(stream) != 0) {
        fprintf(stderr, "Cannot close %s: %s\n", argv[1], strerror(errno));
        return 1;
    }

    return 0;
}
```

- [ ] **Step 2: Write CMake configuration and tests**

Create `CMakeLists.txt`:

```cmake
cmake_minimum_required(VERSION 3.25)

project(ufdtd VERSION 0.1.0 LANGUAGES C)

include(CTest)

option(UFDTD_WARNINGS_AS_ERRORS "Treat project warnings as errors" OFF)

add_library(ufdtd_warnings INTERFACE)
if(CMAKE_C_COMPILER_ID STREQUAL "GNU")
  target_compile_options(ufdtd_warnings INTERFACE -Wall -Wextra -Wpedantic)
  if(UFDTD_WARNINGS_AS_ERRORS)
    target_compile_options(ufdtd_warnings INTERFACE -Werror)
  endif()
endif()

function(add_ufdtd_smoke target source)
  add_executable(${target} ${source})
  target_compile_features(${target} PRIVATE c_std_17)
  target_link_libraries(${target} PRIVATE ufdtd_warnings)
  add_test(NAME ${target} COMMAND ${target})
endfunction()

file(MAKE_DIRECTORY "${PROJECT_SOURCE_DIR}/output/smoke")

add_ufdtd_smoke(math_smoke examples/smoke/math_smoke.c)
add_ufdtd_smoke(memory_smoke examples/smoke/memory_smoke.c)

add_executable(signal_writer examples/smoke/signal_writer.c)
target_compile_features(signal_writer PRIVATE c_std_17)
target_link_libraries(signal_writer PRIVATE ufdtd_warnings)
add_test(
  NAME signal_writer
  COMMAND signal_writer "${PROJECT_SOURCE_DIR}/output/smoke/signal.csv"
)
```

Create `CMakePresets.json`:

```json
{
  "version": 6,
  "configurePresets": [
    {
      "name": "base",
      "hidden": true,
      "generator": "Ninja",
      "cacheVariables": {
        "CMAKE_C_STANDARD": "17",
        "CMAKE_C_STANDARD_REQUIRED": "ON",
        "CMAKE_C_EXTENSIONS": "OFF",
        "CMAKE_EXPORT_COMPILE_COMMANDS": "ON"
      }
    },
    {
      "name": "debug",
      "inherits": "base",
      "binaryDir": "${sourceDir}/build/debug",
      "cacheVariables": {
        "CMAKE_BUILD_TYPE": "Debug"
      }
    },
    {
      "name": "release",
      "inherits": "base",
      "binaryDir": "${sourceDir}/build/release",
      "cacheVariables": {
        "CMAKE_BUILD_TYPE": "Release"
      }
    }
  ],
  "buildPresets": [
    {"name": "debug", "configurePreset": "debug"},
    {"name": "release", "configurePreset": "release"}
  ],
  "testPresets": [
    {
      "name": "debug",
      "configurePreset": "debug",
      "output": {"outputOnFailure": true}
    },
    {
      "name": "release",
      "configurePreset": "release",
      "output": {"outputOnFailure": true}
    }
  ]
}
```

- [ ] **Step 3: Build and run the initial tests**

Run:

```powershell
& $conda run -n ufdtd-c cmake --preset debug
& $conda run -n ufdtd-c cmake --build --preset debug
& $conda run -n ufdtd-c ctest --preset debug
```

Expected: three CTest tests pass.

- [ ] **Step 4: Commit**

```powershell
git add CMakeLists.txt CMakePresets.json examples/smoke
git commit -m "test: add serial C toolchain smoke checks"
```

---

### Task 3: pthread and MPI Smoke Checks

**Files:**
- Create: `examples/smoke/pthread_smoke.c`
- Create: `examples/smoke/mpi_smoke.c`
- Modify: `CMakeLists.txt`

**Interfaces:**
- Consumes: CMake warning target and Conda-provided libwinpthread/MS-MPI.
- Produces: CTest targets `pthread_smoke` and `mpi_smoke`.

- [ ] **Step 1: Write pthread and MPI smoke programs**

Create `examples/smoke/pthread_smoke.c`:

```c
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

struct WorkRange {
    uint64_t first;
    uint64_t last;
    uint64_t sum;
};

static void *sum_range(void *argument)
{
    struct WorkRange *range = argument;
    range->sum = 0U;
    for (uint64_t value = range->first; value <= range->last; ++value) {
        range->sum += value;
    }
    return NULL;
}

int main(void)
{
    pthread_t threads[2];
    struct WorkRange ranges[2] = {
        {1U, 500000U, 0U},
        {500001U, 1000000U, 0U}
    };

    for (size_t index = 0U; index < 2U; ++index) {
        const int error = pthread_create(
            &threads[index], NULL, sum_range, &ranges[index]
        );
        if (error != 0) {
            fprintf(stderr, "pthread_create failed: %s\n", strerror(error));
            return 1;
        }
    }

    for (size_t index = 0U; index < 2U; ++index) {
        const int error = pthread_join(threads[index], NULL);
        if (error != 0) {
            fprintf(stderr, "pthread_join failed: %s\n", strerror(error));
            return 1;
        }
    }

    const uint64_t actual = ranges[0].sum + ranges[1].sum;
    const uint64_t expected = ((uint64_t)1000000U * 1000001U) / 2U;
    if (actual != expected) {
        fprintf(stderr, "pthread sum mismatch.\n");
        return 1;
    }

    printf("pthread smoke passed: sum=%llu\n", (unsigned long long)actual);
    return 0;
}
```

Create `examples/smoke/mpi_smoke.c`:

```c
#include <mpi.h>
#include <stdio.h>

static int report_mpi_error(int error, const char *operation)
{
    char message[MPI_MAX_ERROR_STRING];
    int length = 0;
    MPI_Error_string(error, message, &length);
    fprintf(stderr, "%s failed: %.*s\n", operation, length, message);
    return 1;
}

int main(int argc, char **argv)
{
    int error = MPI_Init(&argc, &argv);
    if (error != MPI_SUCCESS) {
        fprintf(stderr, "MPI_Init failed with code %d.\n", error);
        return 1;
    }

    int rank = -1;
    int size = 0;
    int status = 0;
    int ranks[4] = {-1, -1, -1, -1};

    error = MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    if (error != MPI_SUCCESS) {
        status = report_mpi_error(error, "MPI_Comm_rank");
    }
    error = MPI_Comm_size(MPI_COMM_WORLD, &size);
    if (error != MPI_SUCCESS) {
        status = report_mpi_error(error, "MPI_Comm_size");
    }

    if (status == 0 && size != 4) {
        if (rank == 0) {
            fprintf(stderr, "Expected 4 MPI processes, received %d.\n", size);
        }
        status = 1;
    }

    if (status == 0) {
        error = MPI_Gather(
            &rank, 1, MPI_INT, ranks, 1, MPI_INT, 0, MPI_COMM_WORLD
        );
        if (error != MPI_SUCCESS) {
            status = report_mpi_error(error, "MPI_Gather");
        }
    }

    if (rank == 0 && status == 0) {
        for (int index = 0; index < 4; ++index) {
            if (ranks[index] != index) {
                fprintf(stderr, "Unexpected rank at index %d.\n", index);
                status = 1;
            }
        }
    }

    error = MPI_Bcast(&status, 1, MPI_INT, 0, MPI_COMM_WORLD);
    if (error != MPI_SUCCESS) {
        status = report_mpi_error(error, "MPI_Bcast");
    }

    error = MPI_Finalize();
    if (error != MPI_SUCCESS) {
        fprintf(stderr, "MPI_Finalize failed with code %d.\n", error);
        return 1;
    }

    if (rank == 0 && status == 0) {
        printf("MPI smoke passed with 4 processes.\n");
    }
    return status;
}
```

- [ ] **Step 2: Register the targets**

Append to `CMakeLists.txt`:

```cmake
set(THREADS_PREFER_PTHREAD_FLAG TRUE)
find_package(Threads REQUIRED)
add_ufdtd_smoke(pthread_smoke examples/smoke/pthread_smoke.c)
target_link_libraries(pthread_smoke PRIVATE Threads::Threads)

find_package(MPI REQUIRED COMPONENTS C)
add_executable(mpi_smoke examples/smoke/mpi_smoke.c)
target_compile_features(mpi_smoke PRIVATE c_std_17)
target_link_libraries(mpi_smoke PRIVATE ufdtd_warnings MPI::MPI_C)
add_test(
  NAME mpi_smoke
  COMMAND
    "${MPIEXEC_EXECUTABLE}"
    "${MPIEXEC_NUMPROC_FLAG}" "4"
    ${MPIEXEC_PREFLAGS}
    "$<TARGET_FILE:mpi_smoke>"
    ${MPIEXEC_POSTFLAGS}
)
set_tests_properties(mpi_smoke PROPERTIES TIMEOUT 30)
```

- [ ] **Step 3: Build and run both parallel tests**

Run:

```powershell
& $conda run -n ufdtd-c cmake --preset debug
& $conda run -n ufdtd-c cmake --build --preset debug
& $conda run -n ufdtd-c ctest --preset debug -R "pthread_smoke|mpi_smoke"
```

Expected: both tests pass; MPI output confirms four processes.

- [ ] **Step 4: Commit**

```powershell
git add CMakeLists.txt examples/smoke/pthread_smoke.c examples/smoke/mpi_smoke.c
git commit -m "test: verify pthread and Microsoft MPI"
```

---

### Task 4: Python Post-Processing with TDD

**Files:**
- Create: `scripts/__init__.py`
- Create: `tests/test_plot_signal.py`
- Create: `scripts/plot_signal.py`

**Interfaces:**
- Consumes: CSV with exact header `index,value`.
- Produces: `load_signal(path) -> tuple[numpy.ndarray, numpy.ndarray]` and `plot_signal(input_path, output_path) -> None`.

- [ ] **Step 1: Write the failing tests**

Create an empty `scripts/__init__.py`.

Create `tests/test_plot_signal.py`:

```python
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
    ],
)
def test_load_signal_rejects_invalid_csv(
    tmp_path: Path, content: str, message: str
) -> None:
    csv_path = tmp_path / "invalid.csv"
    csv_path.write_text(content, encoding="utf-8")

    with pytest.raises(ValueError, match=message):
        load_signal(csv_path)


def test_plot_signal_creates_nonempty_png(tmp_path: Path) -> None:
    csv_path = tmp_path / "signal.csv"
    png_path = tmp_path / "signal.png"
    csv_path.write_text("index,value\n0,0\n1,1\n2,0\n", encoding="utf-8")

    plot_signal(csv_path, png_path)

    assert png_path.is_file()
    assert png_path.stat().st_size > 0
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
& $conda run -n ufdtd-c pytest tests/test_plot_signal.py -q
```

Expected: collection fails with `ModuleNotFoundError: No module named 'scripts.plot_signal'`.

- [ ] **Step 3: Implement the parser and plotter**

Create `scripts/plot_signal.py`:

```python
from __future__ import annotations

import argparse
import csv
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
from matplotlib import pyplot as plt


def load_signal(path: Path) -> tuple[np.ndarray, np.ndarray]:
    if not path.is_file():
        raise ValueError(f"Signal file does not exist: {path}")

    indices: list[float] = []
    values: list[float] = []
    with path.open(newline="", encoding="utf-8") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != ["index", "value"]:
            raise ValueError("CSV header must be exactly: index,value")
        for row_number, row in enumerate(reader, start=2):
            try:
                index = float(row["index"])
                value = float(row["value"])
            except (KeyError, TypeError, ValueError) as error:
                raise ValueError(
                    f"Invalid numeric value on CSV row {row_number}"
                ) from error
            if not np.isfinite(index) or not np.isfinite(value):
                raise ValueError(f"CSV row {row_number} must contain finite values")
            indices.append(index)
            values.append(value)

    if not indices:
        raise ValueError("Signal CSV contains no data rows")
    return np.asarray(indices), np.asarray(values)


def plot_signal(input_path: Path, output_path: Path) -> None:
    indices, values = load_signal(input_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    figure, axis = plt.subplots(figsize=(8, 4.5), constrained_layout=True)
    axis.plot(indices, values, color="#005f73", linewidth=2)
    axis.set_xlabel("Sample index")
    axis.set_ylabel("Amplitude")
    axis.set_title("uFDTD environment smoke signal")
    axis.grid(True, alpha=0.3)
    figure.savefig(output_path, dpi=150)
    plt.close(figure)


def main() -> int:
    parser = argparse.ArgumentParser(description="Plot a uFDTD signal CSV.")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    arguments = parser.parse_args()
    plot_signal(arguments.input, arguments.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
& $conda run -n ufdtd-c pytest tests/test_plot_signal.py -q
```

Expected: five tests pass.

- [ ] **Step 5: Commit**

```powershell
git add scripts/__init__.py scripts/plot_signal.py tests/test_plot_signal.py
git commit -m "test: add deterministic signal plotting"
```

---

### Task 5: Idempotent Bootstrap and Verification Scripts

**Files:**
- Create: `scripts/bootstrap.ps1`
- Create: `scripts/verify.ps1`

**Interfaces:**
- Consumes: repository root, `environment.yml`, and Conda installation.
- Produces: a verified `ufdtd-c` environment and generated `output/smoke/signal.csv` / `signal.png`.

- [ ] **Step 1: Write the bootstrap script**

Create `scripts/bootstrap.ps1`:

```powershell
$ErrorActionPreference = 'Stop'

function Get-CondaExecutable {
    $command = Get-Command conda.exe -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }
    $fallback = Join-Path $env:LOCALAPPDATA 'miniconda3\Scripts\conda.exe'
    if (Test-Path -LiteralPath $fallback) {
        return $fallback
    }
    throw 'Conda was not found in PATH or the standard Miniconda location.'
}

function Get-PackageState([string]$Conda, [string]$Environment) {
    $json = & $Conda list -n $Environment --json
    if ($LASTEXITCODE -ne 0) {
        throw "Cannot inspect Conda environment: $Environment"
    }
    $packages = $json | ConvertFrom-Json
    return ($packages | Sort-Object name | ForEach-Object {
        "$($_.name)=$($_.version)=$($_.build_string)=$($_.channel)"
    }) -join "`n"
}

$conda = Get-CondaExecutable
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $repositoryRoot 'environment.yml'
$baseBefore = Get-PackageState $conda 'base'
$cppBefore = Get-PackageState $conda 'cpp_env'
$environments = (& $conda env list --json | ConvertFrom-Json).envs
$targetExists = $environments | Where-Object {
    (Split-Path -Leaf $_) -eq 'ufdtd-c'
}

if ($targetExists) {
    & $conda env update -n ufdtd-c -f $environmentFile
} else {
    & $conda env create -f $environmentFile
}
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to create or update the ufdtd-c environment.'
}

if ($baseBefore -ne (Get-PackageState $conda 'base')) {
    throw 'The Conda base environment changed unexpectedly.'
}
if ($cppBefore -ne (Get-PackageState $conda 'cpp_env')) {
    throw 'The cpp_env environment changed unexpectedly.'
}

& $conda run -n ufdtd-c gcc --version
& $conda run -n ufdtd-c cmake --version
& $conda run -n ufdtd-c ninja --version
& $conda run -n ufdtd-c python --version
```

- [ ] **Step 2: Write the verification script**

Create `scripts/verify.ps1`:

```powershell
$ErrorActionPreference = 'Stop'

function Get-CondaExecutable {
    $command = Get-Command conda.exe -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }
    $fallback = Join-Path $env:LOCALAPPDATA 'miniconda3\Scripts\conda.exe'
    if (Test-Path -LiteralPath $fallback) {
        return $fallback
    }
    throw 'Conda was not found in PATH or the standard Miniconda location.'
}

function Invoke-InEnvironment([string]$Conda, [string[]]$Arguments) {
    & $Conda run -n ufdtd-c --no-capture-output @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Environment command failed: $($Arguments -join ' ')"
    }
}

$conda = Get-CondaExecutable
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repositoryRoot
try {
    New-Item -ItemType Directory -Force -Path 'output\smoke' | Out-Null
    Invoke-InEnvironment $conda @('cmake', '--preset', 'debug')
    Invoke-InEnvironment $conda @('cmake', '--build', '--preset', 'debug')
    Invoke-InEnvironment $conda @('ctest', '--preset', 'debug')
    Invoke-InEnvironment $conda @('cmake', '--preset', 'release')
    Invoke-InEnvironment $conda @('cmake', '--build', '--preset', 'release')
    Invoke-InEnvironment $conda @('ctest', '--preset', 'release')
    Invoke-InEnvironment $conda @('pytest', '-q')
    Invoke-InEnvironment $conda @(
        'python',
        'scripts/plot_signal.py',
        'output/smoke/signal.csv',
        'output/smoke/signal.png'
    )
    $plot = Get-Item -LiteralPath 'output\smoke\signal.png'
    if ($plot.Length -le 0) {
        throw 'Generated signal plot is empty.'
    }
}
finally {
    Pop-Location
}
```

- [ ] **Step 3: Run bootstrap and verification**

Run:

```powershell
& .\scripts\bootstrap.ps1
& .\scripts\verify.ps1
```

Expected: both scripts exit with code 0; Debug and Release CTest plus Pytest report zero failures.

- [ ] **Step 4: Run both scripts a second time**

Run:

```powershell
& .\scripts\bootstrap.ps1
& .\scripts\verify.ps1
```

Expected: the repeated commands also exit with code 0 and protected package state remains unchanged.

- [ ] **Step 5: Commit**

```powershell
git add scripts/bootstrap.ps1 scripts/verify.ps1
git commit -m "build: automate FDTD environment verification"
```

---

### Task 6: Documentation and Final Evidence

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: verified commands and observed versions.
- Produces: bilingual setup/use instructions and an accurate change record.

- [ ] **Step 1: Update bilingual documentation**

Expand both language sections of `README.md` with:

````markdown
## 繁體中文

### 建立環境

```powershell
.\scripts\bootstrap.ps1
```

### 完整驗證

```powershell
.\scripts\verify.ps1
```

### 互動式開發

```powershell
conda activate ufdtd-c
cmake --preset debug
cmake --build --preset debug
ctest --preset debug
```

## English

### Create the environment

```powershell
.\scripts\bootstrap.ps1
```

### Run complete verification

```powershell
.\scripts\verify.ps1
```

### Interactive development

```powershell
conda activate ufdtd-c
cmake --preset debug
cmake --build --preset debug
ctest --preset debug
```
````

Also explain that native Windows uses MS-MPI instead of Open MPI and that the
local PDF is intentionally ignored.

- [ ] **Step 2: Update the changelog**

Add under `Unreleased`:

```markdown
- Added a reproducible Conda GCC/CMake/Ninja/MS-MPI environment.
- Added serial, dynamic-memory, pthread, and four-process MPI smoke tests.
- Added deterministic CSV output and headless Matplotlib verification.
- Added idempotent bootstrap and full verification PowerShell scripts.
```

- [ ] **Step 3: Run fresh complete verification**

Run:

```powershell
& .\scripts\bootstrap.ps1
& .\scripts\verify.ps1
git diff --check
git status --short --ignored
```

Expected:

- Bootstrap exits with code 0.
- Debug CTest: five tests pass.
- Release CTest: five tests pass.
- Pytest: five tests pass.
- `signal.csv` and non-empty `signal.png` exist under ignored `output/smoke`.
- `ufdtd.pdf`, `build/`, and `output/` are ignored.
- No tracked file has whitespace errors.

- [ ] **Step 4: Compare protected environment snapshots**

Run:

```powershell
& $conda list -n base --json | Set-Content -Encoding utf8 "$env:TEMP\ufdtd-base-after.json"
& $conda list -n cpp_env --json | Set-Content -Encoding utf8 "$env:TEMP\ufdtd-cpp-env-after.json"
Compare-Object `
  (Get-Content "$env:TEMP\ufdtd-base-before.json") `
  (Get-Content "$env:TEMP\ufdtd-base-after.json")
Compare-Object `
  (Get-Content "$env:TEMP\ufdtd-cpp-env-before.json") `
  (Get-Content "$env:TEMP\ufdtd-cpp-env-after.json")
```

Expected: both `Compare-Object` commands produce no differences.

- [ ] **Step 5: Commit**

```powershell
git add README.md CHANGELOG.md
git commit -m "docs: document Windows FDTD setup"
```

- [ ] **Step 6: Inspect final repository state**

Run:

```powershell
git log --oneline --decorate -7
git status --short --ignored
```

Expected: implementation commits are present; only ignored book, build, and output artifacts remain.
