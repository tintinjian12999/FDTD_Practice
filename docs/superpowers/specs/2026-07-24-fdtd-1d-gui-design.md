# One-Dimensional FDTD GUI Design

**Date:** 2026-07-24
**Status:** Approved for autonomous implementation
**Branch:** `feat/fdtd-1d-gui`

## Objective

Provide a native Windows desktop interface for configuring, running, and
inspecting the existing one-dimensional C FDTD solver. The GUI must make the
first solver usable without memorizing CLI arguments while preserving the C
executable as the only numerical implementation.

## Selected Approach

Use Python 3.12, Tkinter/ttk, and embedded Matplotlib. The GUI launches
`fdtd1d.exe` with an argument list in a background thread, validates its
generated files with `scripts.visualize_fdtd1d.load_run`, and displays the
validated arrays.

This approach is selected because Tkinter is included in the existing
`ufdtd-c` environment, Matplotlib is already required, and no new runtime or
web service is needed. It also keeps process and data boundaries explicit.

Rejected alternatives:

1. PySide6 would provide more widgets but adds a large dependency and packaging
   surface without improving the numerical workflow.
2. A browser UI would require a local backend or duplicate solver logic in
   JavaScript and would be less natural for the native Windows toolchain.
3. A Python C extension would couple the GUI to solver ABI details and remove
   the independently testable CLI boundary.

## Scope

The first GUI version shall:

- expose every solver parameter documented by the CLI;
- support `additive-abc` and `hard-pmc`;
- support normalized and SI scales;
- select an output directory;
- discover the Release executable first and Debug executable second;
- validate inputs before starting a process;
- warn before replacing recognized existing FDTD output files;
- execute without blocking the Tk event loop;
- allow cancellation of an active process;
- show stdout, stderr, exit state, and concise status text;
- load results only through the strict existing loader;
- display an embedded probe plot;
- display an embedded field snapshot plot;
- provide a snapshot slider, previous/next buttons, and play/pause animation;
- preserve the previously displayed valid result if a new run fails;
- provide Traditional Chinese and English labels;
- be launchable with `python -m gui.fdtd1d_gui`.

The first GUI version shall not:

- implement or duplicate Yee updates, sources, or boundaries in Python;
- edit arbitrary JSON/CSV data;
- add material, PML, TFSF, 2D, or 3D options;
- package an installer or standalone executable;
- create a web service;
- run more than one simulation concurrently.

## Architecture

### `gui/fdtd1d_model.py`

This module is independent of Tk. It defines:

```python
@dataclass(frozen=True)
class SimulationParameters:
    mode: str
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

def validate_parameters(parameters: SimulationParameters) -> None: ...
def build_command(executable: Path, parameters: SimulationParameters) -> list[str]: ...
def find_solver(root: Path, override: Path | None = None) -> Path: ...
def recognized_outputs(directory: Path) -> tuple[Path, ...]: ...
```

Text values deliberately match Tk entry values. Validation uses strict decimal
conversion, finite checks, integer checks, index and mode rules, and the same
scale/Courant rules as the CLI. `build_command` emits normalized arguments with
`--courant`, or SI arguments with `--dx` and `--dt`, never both.

### `gui/fdtd1d_runner.py`

This module owns process execution:

```python
@dataclass(frozen=True)
class RunResult:
    returncode: int
    stdout: str
    stderr: str
    cancelled: bool

class SimulationRunner:
    @property
    def running(self) -> bool: ...
    def run(self, command: list[str]) -> RunResult: ...
    def cancel(self) -> bool: ...
```

The runner uses `subprocess.Popen` with `shell=False`, text pipes, and Windows
no-console flags. A lock protects the active-process reference. `run` rejects
concurrent calls. `cancel` terminates only the runner-owned process.

### `gui/fdtd1d_plot.py`

This module owns Matplotlib presentation. `ResultPlot` embeds one Figure in a
Tk container and draws two axes:

- probe `Ez` versus time;
- snapshot `Ez` versus position.

The plot receives the immutable metadata/data objects returned by `load_run`.
It tracks snapshot group numbers, updates the field line and title, and exposes
`set_frame`, `next_frame`, `previous_frame`, `start`, and `stop`. Animation uses
Tk `after` callbacks, not a second GUI thread.

### `gui/fdtd1d_gui.py`

`FDTD1DApplication` owns widgets and orchestration. It does not parse numerical
data or execute equations.

The main window uses a horizontal paned layout:

- left, fixed-width controls grouped as Simulation, Source, Scale, and Output;
- right, results plot above snapshot controls and a read-only execution log;
- bottom action row with Run, Cancel, progress indicator, and status.

Changing scale disables the unused numeric entries. Changing to `hard-pmc`
sets source index to 0 and leaves the field editable so invalid values are
reported rather than silently corrected later.

## Defaults

The GUI starts with the CLI defaults:

- mode `additive-abc`;
- scale `normalized`;
- grid size 200;
- time steps 450;
- Courant number 1;
- `dx = 0.01 m`;
- `dt = 3.3356409519815207e-11 s`;
- source index 50;
- probe index 100;
- delay 30;
- width 10;
- amplitude 1;
- snapshot interval 10;
- output directory `<repository>/output/fdtd1d-gui`.

When scale changes, entered values are retained. Only the active scale values
are validated and emitted.

## Data Flow

1. Run reads all Tk variables into `SimulationParameters`.
2. The pure validator rejects malformed or contradictory input.
3. The GUI resolves `fdtd1d.exe`.
4. If recognized outputs exist, the user must confirm replacement.
5. Controls are disabled and an indeterminate progress bar starts.
6. A worker thread calls `SimulationRunner.run`.
7. The worker puts `RunResult` into a thread-safe queue.
8. The Tk thread polls the queue with `after`.
9. A zero exit code triggers `load_run(output_directory)`.
10. Only a fully validated run replaces the displayed plot and enables
    snapshot controls.
11. Failure or cancellation stops progress, restores controls, records the
    process result, and preserves the earlier valid plot.

## Validation and Error Handling

- Empty values, surrounding junk, booleans, non-finite floats, and non-decimal
  integer forms are rejected.
- Grid size must be at least 5 and time/snapshot counts must be positive.
- Probe and source indices must be in range.
- `hard-pmc` requires source index 0.
- `additive-abc` requires source indices from 2 through `grid_size - 3`.
- Source delay is nonnegative, width is positive, and amplitude is finite.
- Normalized scale requires `0 < courant <= 1`.
- SI scale requires positive `dx` and `dt`, and derived
  `0 < c0 * dt / dx <= 1`.
- The output path must be nonempty and below the Windows `MAX_PATH` boundary
  used by the CLI.
- Validation errors appear in one message box and no process is created.
- Missing executable, process errors, nonzero exit codes, and output-validation
  errors are logged and shown without destroying the prior result.
- Window close while running asks for confirmation, terminates the owned
  process, and then destroys the window.

## Testing

Headless automated tests shall cover:

- normalized and SI command construction;
- every numerical and cross-field validation category;
- solver discovery precedence and explicit override;
- recognized-output detection;
- real small-run execution through `SimulationRunner`;
- cancellation and concurrent-run rejection using a short Python child;
- runner cleanup after success and failure;
- snapshot grouping helpers and frame bounds;
- import of `gui.fdtd1d_gui` without creating a root window.

Tk widget geometry is not asserted in automation. Final verification launches
the GUI module with `--check`, which verifies Tkinter, executable discovery,
parameter construction, and plotting imports without opening a window. A real
CLI run remains the integration boundary for solver correctness.

## Documentation and Verification

README sections in both languages will document launch, workflow, scale
behavior, overwrite confirmation, cancellation, and first-version limitations.
CHANGELOG will record the desktop GUI. `scripts/verify.ps1` will run GUI tests
and `python -m gui.fdtd1d_gui --check`.

## Success Criteria

- The GUI launches in `ufdtd-c` on Windows without a new dependency.
- A default normalized run produces and displays a valid probe and snapshots.
- SI runs use the same C executable and strict output loader.
- The window stays responsive during execution and can cancel safely.
- Invalid inputs and failed runs never replace the current valid display.
- The complete verification script passes in Debug and Release.
- An independent code review has no unresolved Critical or Important issue.
