# Changelog

## Unreleased

- Separated source injection from boundary selection across the C API, CLI,
  schema version 2 output, strict Python loader, and desktop GUI.
- Added all four hard/additive and PMC/Mur1 combinations, common interior-source
  validation, a hard-source reflection warning, and legacy numerical regression
  coverage for the default additive/Mur1 configuration.
- Added a native Windows Tkinter GUI that configures and runs the C solver
  without duplicating the numerical implementation.
- Added responsive background execution, owned-process cancellation, output
  replacement confirmation, bilingual controls, execution logging, and strict
  result loading.
- Added embedded Matplotlib probe and field plots with snapshot navigation and
  animation playback.
- Added GUI parameter, process lifecycle, visible-window, plotting, and real
  solver integration tests plus a noninteractive environment check.
- Added a book-faithful C17 reproduction of Program 3.1 with a numerical peak
  regression.
- Added a reusable one-dimensional Yee-grid FDTD core with hard-source and
  additive-source modes, first-order Mur absorbing boundaries, normalized and
  SI scales, Courant validation, and finite-field checks.
- Added a strict native Windows CLI with deterministic JSON, probe CSV, and
  long-format field snapshot output.
- Added strict post-processing validation, probe and final-field PNG plots,
  and animated GIF field propagation.
- Added direct C numerical tests and Python integration, schema, malformed-data,
  scale-equivalence, and visualization tests.
- Added a reproducible Conda GCC/CMake/Ninja/MS-MPI environment.
- Added serial, dynamic-memory, pthread, and four-process MPI smoke tests.
- Added deterministic CSV output and headless Matplotlib verification.
- Added idempotent bootstrap and full verification PowerShell scripts.
- Added strict CSV shape checks, deterministic sample validation, and safe MPI
  process-count rejection.
- Approved the native Windows C/FDTD development-environment design.
- Added the initial repository governance and documentation files.
