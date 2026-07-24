# Native Windows C/FDTD Environment Design

**Date:** 2026-07-24

**Status:** Approved for written-spec review

**Project:** uFDTD

## 1. Context

The project will support study and implementation of John B. Schneider's
*Understanding the Finite-Difference Time-Domain Method*, dated March 22,
2026. The book develops one-, two-, and three-dimensional FDTD programs in C.
It uses GNU C compilation, the math library, incremental builds, POSIX threads,
and Open MPI-style commands. Its visualization appendices use MATLAB.

The target computer runs 64-bit Windows 11. It has Miniconda 25.9.1 and Visual
Studio Community 2022 installed. An existing Conda environment named
`cpp_env` contains GCC 5.3.0, Clang, NumPy, and Matplotlib, but that GCC release
is too old to serve as the baseline for a new project. WSL is not installed,
and the selected design must remain native to Windows.

A Conda dry run confirmed that a new environment can consistently resolve GCC
15.2, CMake, Ninja, Microsoft MPI, Python 3.12, NumPy, Matplotlib, and Pytest
from conda-forge. The modern GCC dependency set includes a compatible
winpthreads runtime. Explicitly requesting the legacy `winpthreads` package
causes an incompatible dependency solve and is therefore prohibited.

## 2. Goals

1. Create a reproducible, isolated native Windows C development environment.
2. Preserve the book's GNU C and pthread programming model where practical.
3. Support Microsoft MPI for local multi-process exercises corresponding to
   the book's MPI chapter.
4. Provide CMake and Ninja as the canonical build interface.
5. Replace MATLAB-only post-processing with Python, NumPy, and Matplotlib.
6. Prove the environment works through executable serial, pthread, MPI, and
   plotting smoke tests.
7. Avoid modifying the Conda `base` and `cpp_env` environments.

## 3. Non-Goals

1. This phase will not implement a production FDTD solver.
2. This phase will not transcribe all source listings from the book.
3. This phase will not install WSL, Cygwin, or MSYS2.
4. This phase will not configure multi-node MPI, schedulers, or cluster
   credentials.
5. This phase will not configure a remote Git repository, push changes, or
   deploy software.
6. This phase will not add a graphical application or IDE-specific project.

## 4. Selected Architecture

### 4.1 Environment

Create a dedicated Conda environment named `ufdtd-c` from conda-forge with
strict channel priority. The top-level dependency constraints will be:

- `gcc_win-64=15.2`
- `cmake>=4.4,<5`
- `ninja>=1.13,<2`
- `msmpi=10.1.1`
- `python=3.12`
- `numpy>=2.5,<3`
- `matplotlib>=3.11,<4`
- `pytest>=9,<10`

The environment file will not name the legacy `winpthreads` package.
`gcc_win-64` will supply the compatible `libwinpthread` dependency. Bootstrap
commands will use `--override-channels` so packages do not leak in from the
user's global Conda channel configuration.

The project will invoke tools through `conda run -n ufdtd-c` so verification
does not depend on interactive shell activation. Interactive development may
still use `conda activate ufdtd-c`.

### 4.2 Language and Compiler Policy

- C language standard: C17.
- Compiler family: GNU GCC for 64-bit Windows UCRT.
- Required warning flags: `-Wall -Wextra -Wpedantic`.
- Debug optimization and symbols: `-O0 -g3`.
- Release optimization: `-O3 -DNDEBUG`.
- Warnings are not errors by default because older educational examples may
  contain non-fatal constructs.
- A CMake option named `UFDTD_WARNINGS_AS_ERRORS` will allow project-owned
  code to opt into `-Werror`.

### 4.3 Build System

CMake is the only supported configuration interface, and Ninja is the default
generator. `CMakePresets.json` will define:

- `debug`: configure into `build/debug`.
- `release`: configure into `build/release`.
- Matching build and test presets for both configurations.

The project version will be declared once through the top-level CMake
`project()` command. No other project file will duplicate the version number.

### 4.4 Threading

CMake will set `THREADS_PREFER_PTHREAD_FLAG` and call
`find_package(Threads REQUIRED)`. pthread targets will link through
`Threads::Threads`. Configuration must fail if a pthread-compatible setup
cannot compile the smoke test; it must not silently substitute a different
threading API.

### 4.5 MPI

CMake will call `find_package(MPI REQUIRED COMPONENTS C)` and MPI targets will
link through `MPI::MPI_C`. CTest will launch MPI programs using the variables
provided by `FindMPI`, including `MPIEXEC_EXECUTABLE` and
`MPIEXEC_NUMPROC_FLAG`.

Microsoft MPI replaces Open MPI on native Windows. The MPI C API remains the
same for the book's introductory calls, but compilation and launch details may
differ. The project will use CMake rather than depend on an `mpicc` wrapper.

If automatic detection fails, configuration must report the detected Conda
prefix, MPI include search result, library search result, and runtime search
result. There will be no silent serial fallback.

## 5. Repository Structure

```text
uFDTD/
|-- .gitignore
|-- .gitlab-ci.yml
|-- CHANGELOG.md
|-- CMakeLists.txt
|-- CMakePresets.json
|-- README.md
|-- catalog-info.yaml
|-- environment.yml
|-- examples/
|   `-- smoke/
|       |-- math_smoke.c
|       |-- memory_smoke.c
|       |-- mpi_smoke.c
|       |-- pthread_smoke.c
|       `-- signal_writer.c
|-- scripts/
|   |-- bootstrap.ps1
|   |-- plot_signal.py
|   `-- verify.ps1
|-- tests/
|   `-- test_plot_signal.py
|-- docs/
|   `-- superpowers/
|       |-- plans/
|       `-- specs/
|-- output/
`-- ufdtd.pdf
```

Generated `build/` and `output/` content will not be committed. The local book
PDF will also remain untracked. The scripts will create required output
directories at runtime.

## 6. Component Responsibilities

### 6.1 `environment.yml`

Defines the reproducible top-level dependencies and the `ufdtd-c` environment
name. It uses conda-forge as its sole declared channel.

### 6.2 `scripts/bootstrap.ps1`

1. Locate Conda through the current command path or the standard
   `%LOCALAPPDATA%\miniconda3` installation.
2. Fail with an actionable message if Conda cannot be found.
3. Create `ufdtd-c` when absent.
4. Update `ufdtd-c` from `environment.yml` when present.
5. Avoid `--prune` so unrelated user-installed packages are not silently
   removed.
6. Print the installed compiler, CMake, Ninja, Python, and MPI runtime
   versions.

The script must be safe to run repeatedly.

### 6.3 `scripts/verify.ps1`

Runs the complete verification pipeline through `conda run`:

1. Configure the Debug preset.
2. Build the Debug preset.
3. Run Debug CTest.
4. Configure the Release preset.
5. Build the Release preset.
6. Run Release CTest.
7. Run Pytest.

It stops on the first failing command and returns a nonzero process exit code.

### 6.4 C Smoke Programs

- `math_smoke.c`: checks standard C math operations against known values.
- `memory_smoke.c`: checks dynamic allocation, initialization, access, and
  release.
- `pthread_smoke.c`: divides an integer range between two pthread workers and
  compares their combined result with a serial reference.
- `mpi_smoke.c`: runs four ranks, gathers rank identifiers, verifies the set
  `0,1,2,3`, and communicates the final result to all ranks.
- `signal_writer.c`: writes deterministic `index,value` samples to
  `output/smoke/signal.csv`.

Every allocation, file operation, pthread call, and MPI call must have
explicit error handling.

### 6.5 Python Post-Processing

`plot_signal.py` will:

1. Use Matplotlib's non-interactive `Agg` backend.
2. Parse the CSV header and numeric rows.
3. Reject missing, empty, malformed, or non-finite data.
4. Plot the signal with labeled axes and a grid.
5. Write `output/smoke/signal.png`.

`test_plot_signal.py` will validate the parser, malformed-input behavior, and
successful creation of a non-empty PNG.

## 7. Data Flow

```text
signal_writer
    -> output/smoke/signal.csv
    -> plot_signal.py
    -> output/smoke/signal.png
    -> Pytest validation
```

CSV is selected for the smoke path because it is transparent and easy to
inspect. Binary field snapshots may be added in a later FDTD implementation
phase without changing this environment design.

## 8. Error Handling

1. PowerShell scripts check every external command's exit code.
2. Missing Conda, compiler, CMake, Ninja, pthread support, MPI headers,
   MPI libraries, or `mpiexec` causes an immediate, specific failure.
3. C allocation failures are reported to standard error before cleanup.
4. pthread error codes are converted into diagnostic messages.
5. MPI errors are reported with `MPI_Error_string` when MPI is initialized.
6. MPI tests have a 30-second CTest timeout.
7. The project will not change Windows Firewall rules automatically. A
   firewall-related launch failure will be reported with manual review
   guidance.
8. Output writes use checked return values and close files on every path.
9. Plotting rejects non-finite values rather than generating a misleading
   figure.

## 9. Test Strategy

### 9.1 CTest

CTest will cover:

- Standard math with absolute error no greater than `1e-12`.
- Dynamic allocation behavior.
- Exact pthread integer-sum agreement with the serial reference.
- Four-rank MPI execution and rank-set validation.
- Successful CSV generation.

Both Debug and Release configurations must pass.

### 9.2 Pytest

Pytest will cover:

- Valid CSV parsing.
- Missing header rejection.
- Malformed numeric value rejection.
- Non-finite value rejection.
- PNG generation with a nonzero file size.

### 9.3 Idempotence

After the first successful run, `bootstrap.ps1` and `verify.ps1` will each be
run a second time. Both repetitions must succeed without altering the Conda
`base` or `cpp_env` environments.

## 10. Acceptance Criteria

The environment phase is complete only when all of the following are
observed in a fresh verification run:

1. `ufdtd-c` appears in `conda env list`.
2. GCC reports version 15.2.x.
3. Debug configure, build, and CTest complete with zero failures.
4. Release configure, build, and CTest complete with zero failures.
5. The pthread test passes with two worker threads.
6. The MPI test passes with exactly four local processes.
7. Pytest completes with zero failures.
8. `signal.csv` contains the expected deterministic samples.
9. `signal.png` exists and has nonzero size.
10. The second bootstrap and verification runs also pass.
11. `base` and `cpp_env` retain their original package state.

## 11. Documentation and Governance

- `README.md` remains bilingual in Traditional Chinese and English.
- `CHANGELOG.md` records environment and verification changes.
- `.gitignore` excludes secrets, virtual environments, caches, build trees,
  and generated output.
- `catalog-info.yaml` declares no unverified external service or API
  dependencies.
- `.gitlab-ci.yml` includes only the pinned DiConAtlas validator and does not
  introduce deployment or Docker behavior.
- No remote or deployment action is part of this phase.

## 12. Risks and Mitigations

### 12.1 MS-MPI Discovery

Risk: CMake may not locate all MS-MPI assets inside the Conda prefix.

Mitigation: `FindMPI` configuration output and a compile-and-run smoke test
must prove header, library, and `mpiexec` discovery. Failure stops the build
with the relevant paths shown.

### 12.2 Windows Firewall Prompt

Risk: The first multi-process MPI launch may trigger a firewall prompt.

Mitigation: Test local four-process execution and report the executable that
requires review. Do not create firewall rules automatically.

### 12.3 Educational Code Portability

Risk: Some book listings assume Unix paths, `-lm`, Open MPI wrappers, or
historic C conventions.

Mitigation: Keep the solver code's numerical logic separate from platform
integration. CMake targets encapsulate compiler, pthread, and MPI details.

### 12.4 Package Drift

Risk: Unbounded Conda dependencies may resolve to incompatible future
versions.

Mitigation: Pin the compiler and MPI versions and constrain major versions of
the build and Python tools. Record the fully resolved environment after
successful installation for diagnostic reproducibility.

## 13. Design Decision Summary

The project uses a Conda-centered, native Windows GNU C environment. It favors
CMake targets over platform-specific compiler command lines, uses
winpthreads-compatible GCC for the book's threading model, substitutes
Microsoft MPI for Open MPI, and uses Python for visualization. Completion is
defined by repeatable executable evidence, not by package installation alone.
