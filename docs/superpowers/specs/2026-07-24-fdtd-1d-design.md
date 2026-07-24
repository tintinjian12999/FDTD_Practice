# One-Dimensional FDTD Program Design

**Date:** 2026-07-24  
**Status:** Approved for autonomous implementation  
**Reference:** John B. Schneider, *Understanding the Finite-Difference
Time-Domain Method*, Sections 3.3-3.9 and 6.3-6.4

## Objective

Implement the first electromagnetic solver in the uFDTD project while serving
two different purposes:

1. Preserve a compact, standalone C program that can be compared directly with
   Program 3.1 in the reference book.
2. Establish a reusable, tested one-dimensional FDTD core that can later accept
   material models, TFSF boundaries, improved ABCs, pthread, and MPI support.

The implementation must remain native to 64-bit Windows, use the existing
`ufdtd-c` Conda environment, compile as C17 with GCC, and integrate with the
current CMake, CTest, Pytest, and visualization workflow.

## Scope

### Included

- A standalone reproduction of Program 3.1.
- A reusable one-dimensional free-space Yee-grid solver.
- Hard-source/PMC and additive-source/absorbing-boundary modes.
- Normalized and SI coordinate modes.
- Command-line configuration with validated defaults.
- Probe and full-domain snapshot CSV output.
- Static waveform and field plots.
- Animated GIF generation from snapshots.
- Unit, integration, numerical-regression, and visualization tests.
- Bilingual usage documentation.

### Excluded

- Dielectric or conductive materials.
- TFSF injection.
- PML.
- Frequency-domain transforms.
- pthread or MPI acceleration of the solver.
- A desktop GUI; this is a separately designed second stage after the solver
  branch is complete and pushed.

## Architecture

```text
examples/ch03/book_1d_bare_bones.c
    Standalone Program 3.1 reference implementation

include/ufdtd/fdtd1d.h
src/fdtd1d.c
    Reusable solver API and numerical state

apps/fdtd1d_cli.c
    Argument parsing, validation, run control, and output orchestration

scripts/visualize_fdtd1d.py
    Strict CSV ingestion, static plots, and animated GIF generation

tests/c/test_fdtd1d.c
tests/test_fdtd1d_cli.py
tests/test_visualize_fdtd1d.py
    Core, CLI, numerical, schema, and visualization verification
```

The standalone book program must not call the reusable core. This intentional
duplication keeps the book example readable and prevents later abstractions
from obscuring the original algorithm. Numerical regression tests, rather
than shared implementation, keep the two paths aligned.

## Numerical Model

The modular solver uses an `Ez`/`Hy` one-dimensional Yee grid in homogeneous
free space. Both arrays contain `grid_size` doubles. Magnetic nodes from
`0` through `grid_size - 2` participate in the standard update; the final
magnetic element is retained to express the Program 3.1 PMC behavior.

For Courant number \(S_c\) and free-space impedance \(\eta_0\), the update
equations are

\[
H_y^{q+1/2}[m] =
H_y^{q-1/2}[m] +
\frac{S_c}{\eta_0}
\left(E_z^q[m+1]-E_z^q[m]\right)
\]

and

\[
E_z^{q+1}[m] =
E_z^q[m] +
S_c\eta_0
\left(H_y^{q+1/2}[m]-H_y^{q+1/2}[m-1]\right).
\]

The source waveform is

\[
g(q)=A\exp\left[-\left(\frac{q-q_0}{w}\right)^2\right],
\]

where amplitude \(A\), delay \(q_0\), and width \(w\) are configurable.

The implementation uses:

- \(c_0=299792458\ \mathrm{m/s}\).
- \(\eta_0=376.730313668\ \Omega\) in the modular solver.
- `377.0` ohms in the standalone book reproduction, matching Program 3.1.
- IEEE-754 `double` for fields, coefficients, coordinates, and sources.

## Simulation Modes

### `hard-pmc`

- Applies the Gaussian as a hard source at `Ez[0]`.
- Updates electric nodes `1` through `grid_size - 1`.
- Leaves `Hy[grid_size - 1]` at zero, forming the right PMC boundary.
- Reproduces the physical behavior of Program 3.1.
- Rejects a nonzero source index.

### `additive-abc`

- Adds the Gaussian source at an interior electric node.
- Restricts the source index to `2` through `grid_size - 3`.
- Updates electric nodes `1` through `grid_size - 2`.
- Applies first-order Mur ABCs to both electric-field ends after the interior
  electric update.
- Uses

\[
\gamma=\frac{S_c-1}{S_c+1}
\]

for free-space boundaries. At \(S_c=1\), this reduces to the exact
one-dimensional delay-copy boundary from Section 3.9.

## Scale Modes

### `normalized`

- Accepts `--courant`.
- Uses normalized `dx = 1` and `dt = courant`.
- Reports position in cells and time in normalized time coordinates.

### `si`

- Accepts `--dx` in meters and `--dt` in seconds.
- Calculates \(S_c=c_0\Delta t/\Delta x\).
- Reports position in meters and time in seconds.

Both modes require finite positive parameters and \(0<S_c\le1\). Values above
the one-dimensional CFL limit are rejected before allocation or output-file
creation.

## Reusable C API

The public header exposes:

- `FDTD1DMode` and `FDTD1DScale` enums.
- `FDTD1DConfig` with grid, time, source, probe, snapshot, and scale fields.
- An opaque `FDTD1D` state.
- Default normalized and SI configuration constructors.
- Configuration validation with caller-provided error storage.
- Create/destroy functions.
- One-step advancement.
- Read-only electric and magnetic field accessors.
- Current step, time coordinate, position coordinate, and Courant accessors.

Allocation failure, invalid state, invalid configuration, and arithmetic
non-finiteness return explicit status codes. Library functions do not print or
terminate the process.

## Command-Line Interface

The `fdtd1d` executable supports:

```text
--mode hard-pmc|additive-abc
--scale normalized|si
--grid-size N
--time-steps N
--courant VALUE
--dx METERS
--dt SECONDS
--source-index N
--probe-index N
--source-delay VALUE
--source-width VALUE
--source-amplitude VALUE
--snapshot-interval N
--output-dir PATH
--help
```

Defaults:

```text
mode                 additive-abc
scale                normalized
grid-size            200
time-steps            450
courant              1.0
source-index          50
probe-index           100
source-delay          30
source-width          10
source-amplitude      1
snapshot-interval     10
output-dir            output/fdtd1d
```

For SI scale, both `--dx` and `--dt` are mandatory and `--courant` is
rejected. For normalized scale, `--dx` and `--dt` are rejected. Unknown,
duplicate, incomplete, contradictory, non-finite, or out-of-range arguments
produce a concise diagnostic, print usage to standard error, and return exit
code `2`. Runtime and file-I/O failures return `1`; success returns `0`.

## Output Contract

The CLI creates the output directory only after all arguments and physics
constraints pass.

### `probe.csv`

```text
time_step,time,ez
```

Contains exactly one data row after every completed FDTD step.

### `snapshots.csv`

```text
time_step,time,index,position,ez
```

Uses long format. A snapshot is recorded after a completed step whenever
`time_step % snapshot_interval == 0`, including step zero. Each recorded step
contains exactly `grid_size` contiguous index rows.

### `run.json`

Contains the resolved mode, scale, grid size, time steps, Courant number,
`dx`, `dt`, coordinate units, source settings, probe index, snapshot interval,
and output schema version. All writes are checked. A partially written file
causes a nonzero exit; output streams are closed on every path.

## Standalone Book Program

`book_1d_bare_bones` preserves:

- 200 electric and magnetic nodes.
- 250 time steps.
- Courant number one.
- `imp0 = 377.0`.
- Gaussian hard source at `Ez[0]`, delay 30, width 10.
- `Ez[50]` written once per time step to standard output.

The code adds explicit `int main(void)`, braces, checked output, and English
comments, but does not introduce dynamic allocation, configuration structs,
or solver abstractions.

## Visualization

`python -m scripts.visualize_fdtd1d OUTPUT_DIR` strictly validates all three
output files before plotting. It produces:

- `probe.png`: `Ez` at the probe versus time.
- `snapshot_final.png`: the final recorded `Ez` spatial distribution.
- `field.gif`: all recorded snapshots in chronological order.

Matplotlib uses the `Agg` backend. GIF output uses Pillow through Matplotlib.
The visualizer rejects missing columns, duplicate indices, non-contiguous
snapshots, inconsistent grid sizes, non-finite data, non-monotonic time,
metadata/schema disagreement, or an empty dataset. Existing visualization
files are replaced only after the inputs validate.

## Testing Strategy

### C tests

- Default configuration validity.
- Rejection of invalid sizes, indices, source widths, non-finite values, and
  unstable Courant numbers.
- Zero-initialized state.
- Program 3.1 probe peak at time step 80.
- Normalized/SI field equivalence for the same Courant number.
- Finite fields for every tested step.
- First-order ABC at \(S_c=1\) leaves a maximum residual below `1e-9` after
  the Gaussian pulse exits the domain.

### CLI and numerical integration tests

- The standalone book program emits 250 finite samples.
- Its maximum occurs at index 80 and is within `1e-12` of unity.
- CLI output row counts and exact headers match the contract.
- Snapshot time groups contain every grid index exactly once.
- SI and normalized runs with equal \(S_c\) agree within absolute tolerance
  `1e-12`.
- Invalid CFL and contradictory scale arguments create no output directory.
- Re-running into an existing directory replaces the three data files rather
  than appending stale data.

### Visualization tests

- Valid small deterministic data produces two nonempty PNGs and a GIF.
- GIF frame count equals the number of snapshot groups.
- Malformed schema, non-finite data, missing indices, and metadata mismatch
  fail with specific errors and create no new visualization.

### Full regression

- Debug and Release build cleanly with warnings enabled.
- `UFDTD_WARNINGS_AS_ERRORS=ON` passes.
- All CTest and Pytest tests pass.
- Existing environment smoke tests remain green.
- `scripts/verify.ps1` includes the new solver and visualization checks.

## Documentation

README additions provide:

- The relationship between Program 3.1 and the modular solver.
- Build and run examples for both modes and scales.
- The CFL condition and unit interpretation.
- Output schema descriptions.
- Static plot and GIF commands.
- A clear statement that the first solver is homogeneous one-dimensional free
  space and is not yet a general material solver.

CHANGELOG records the new solver, CLI, numerical tests, and visualization.

## Delivery

The solver work is developed on `feat/fdtd-1d`, reviewed, fully verified, and
pushed to `origin/feat/fdtd-1d`. The subsequent GUI stage branches from that
verified commit and does not alter the solver's numerical equations.
