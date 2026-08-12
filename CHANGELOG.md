# Changelog

## Unreleased

- Expand all 17 web lessons into a beginner-ready sequence with prerequisites,
  concept explanations, worked examples, equation-to-C bridges, guided
  experiments, misconception corrections, and self-check answers.
- Add fixed and automatic field-axis modes with visible numeric limits.
- Add local-impedance magnetic normalization and right/left traveling-field views.
- Clarify dielectric-interface reflection behavior in the interactive lessons.

- Added a 17-lesson Traditional Chinese interactive FDTD companion built with
  React, TypeScript, MDX, KaTeX, Canvas 2D, and a Web Worker.
- Added a narrow Emscripten adapter so native tests and the browser execute the
  same C numerical core.
- Added one-dimensional TFSF excitation, linear nondispersive material layers,
  independent left/right terminations, graded matched absorbing layers, and a
  guarded unstable-Courant lesson mode.
- Added physical acceptance tests for TFSF leakage, Fresnel reflection, lossy
  attenuation, absorbing-layer reflection, and native/adapter equivalence.
- Added local progress import/export, dual code presentations, MIT/CC BY-SA
  licensing, and GitHub Pages deployment.
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
