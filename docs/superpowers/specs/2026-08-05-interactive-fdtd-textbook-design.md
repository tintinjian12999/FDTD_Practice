# Interactive FDTD Textbook Design

## Status

Approved through the design interview completed on 2026-08-05. This document
defines the first public release and the architecture used to extend the site
toward full original coverage of the textbook's subject matter.

## Product Goal

Build a public, original Traditional Chinese learning site for senior
undergraduate and graduate engineering students. The site teaches C and FDTD
through derivations, annotated code, guided experiments, and browser-executed
animations. English technical terms remain visible and all source-code comments
are English.

The site covers the knowledge rather than reproducing the book. It must not
publish `ufdtd.pdf`, scanned pages, original figures, or substantial verbatim
text. Book chapter and section references are bibliographic cross-references.

## Licensing

- Software: MIT.
- Original lessons, diagrams, and instructional animation content:
  CC BY-SA 4.0.
- Third-party books and PDFs are excluded from both licenses.

## First Public Release

The first release is a complete one-dimensional learning path:

1. Numerical grids and finite differences.
2. Maxwell equations and one-dimensional Yee updates.
3. A bare-bones C simulation.
4. Electric/magnetic staggering and phased stepping.
5. Gaussian hard sources and non-transparency.
6. Gaussian additive sources.
7. PMC reflection.
8. Simple absorbing boundaries and first-order Mur.
9. Courant stability, including a guarded unstable experiment.
10. Normalized and SI scales.
11. Probes, snapshots, energy diagnostics, and waterfall views.
12. Bare-bones to modular C design.
13. One-dimensional TFSF formulation.
14. Dielectric interfaces and Fresnel coefficients.
15. Linear lossy material.
16. Graded impedance-matched absorbing layers as the one-dimensional
    foundation for PML.
17. A combined free-exploration sandbox.

The release deliberately excludes harmonic and Ricker sources, DFT analysis,
dispersive materials, true two-dimensional split-field or un-split PML, 2D,
3D, solver parallelization, and near-to-far-field transforms. These remain on
the roadmap and must not be implied by the user interface.

## Numerical Domain Model

The numerical core is a deep C module. Native CLI, tests, and WebAssembly use
the same implementation. Callers provide one experiment description and then
advance or inspect the simulation; callers never calculate update
coefficients, TFSF corrections, or absorbing profiles.

### Domain

The domain is a one-dimensional Yee grid with a uniform spatial step. The grid
configuration contains cell count, time-step count, scale, `dx`, `dt`, and the
resolved Courant number. Normalized and SI configurations represent identical
dimensionless field evolution when their Courant numbers match.

### Excitation

One simulation has exactly one excitation:

- Point source: hard or additive Gaussian injection at an interior electric
  node.
- TFSF: Gaussian incident field with one seam and a left-to-right or
  right-to-left propagation direction.

Multiple simultaneous sources, arbitrary waveforms, and user callbacks are
not part of this interface.

### Materials

Materials are ordered, non-overlapping half-open index regions. Each region
defines linear, isotropic, nondispersive `epsilon_r`, `mu_r`, `sigma_e`, and
`sigma_m`. Uncovered cells use vacuum. The module validates the regions and
precomputes per-node electric and magnetic update coefficients.

The first release supports presets for vacuum, a dielectric interface, a lossy
slab, and an impedance-matched layer. It does not support cell-by-cell editing
or dispersive constitutive state.

In SI configurations `sigma_e` is electric conductivity in siemens per metre
and `sigma_m` is the magnetic-loss analogue in ohms per metre. In normalized
configurations both values are normalized loss rates. Impedance matching
requires `sigma_e / epsilon = sigma_m / mu`; equal numeric values satisfy this
condition only in the normalized vacuum convention.

The first-release TFSF incident-field generator assumes vacuum at its two
correction cells. First-order Mur likewise assumes vacuum at its two reference
cells on the selected edge. Configuration validation rejects non-vacuum
material regions at those cells instead of silently applying the wrong
incident impedance or phase velocity.

The first-release analytic TFSF generator also requires `Sc = 1`. This makes
the half-cell incident correction exact on the one-dimensional vacuum Yee
grid. Supporting `Sc != 1` without avoidable scattered-field leakage requires
an auxiliary numerical incident-field grid and remains a later extension.

### Terminations

Left and right terminations are independent. Each side selects:

- PMC symmetry;
- first-order Mur;
- a graded impedance-matched absorbing layer.

An absorbing-layer termination reserves a caller-selected number of edge
cells. The caller specifies thickness, polynomial grading order, and target
reflection. The core derives electric and magnetic conductivity profiles and
the outer-wall treatment. User material regions may not overlap reserved edge
layers in the first release.

The site calls this feature a "1D matched absorbing layer / PML foundation".
It must not label it as a complete 2D PML implementation.

### Observations

The module exposes read-only electric and magnetic arrays, current time and
phase, probe samples, and aggregate finite-field energy. Snapshot, CSV, JSON,
Canvas, and lesson rendering remain adapter responsibilities.

## Step Semantics

A full time step has four observable teaching phases:

1. Magnetic phase: update `Hy` with material coefficients and apply the TFSF
   magnetic correction when selected.
2. Electric phase: update interior `Ez` with material coefficients.
3. Excitation phase: apply point injection or the TFSF electric correction.
4. Termination phase: update the selected left and right terminations, reject
   non-finite fields, evaluate guarded-instability limits, and complete the
   time step.

Fast playback calls the full-step function. Teaching mode advances one phase
at a time and highlights the corresponding formula and C code. Both routes
execute the same internal phase functions.

## C Interface Shape

The public interface is centered on nested configuration values and an opaque
simulation handle:

```c
struct FDTD1DExperimentConfig;
struct FDTD1D;

enum FDTD1DStatus fdtd1d_validate_experiment(
    const struct FDTD1DExperimentConfig *config,
    char *error,
    size_t error_size
);

struct FDTD1D *fdtd1d_create(
    const struct FDTD1DExperimentConfig *config,
    char *error,
    size_t error_size
);

enum FDTD1DStatus fdtd1d_step(struct FDTD1D *simulation);
enum FDTD1DStatus fdtd1d_advance_phase(struct FDTD1D *simulation);
void fdtd1d_destroy(struct FDTD1D *simulation);
```

Configuration contains nested domain, excitation, material-region list,
left/right termination, observation, and safety-limit values. There are no
public numerical callbacks or per-cell update methods. The current experimental
configuration is intentionally replaced; compatibility belongs in CLI/config
adapters rather than inside the numerical module.

## Web Architecture

The site lives under `web/` in the existing monorepo:

```text
web/
|-- content/              MDX lessons and cross-references
|-- public/               generated WASM and original static assets
|-- src/
|   |-- simulation/       SimulationBackend seam and WASM adapter
|   |-- lessons/          lesson navigation and progress
|   |-- labs/             guided experiments and sandbox
|   `-- visualization/    Canvas renderers and plots
`-- tests/
```

React, TypeScript, Vite, MDX, and KaTeX provide the teaching interface. The C
core is compiled with Emscripten and runs in a Web Worker. Canvas 2D draws
`Ez`, `Hy`, material regions, source/TFSF seams, probes, and terminations without
causing React frame-by-frame reconciliation.

`SimulationBackend` is a real seam with two adapters: the WebAssembly adapter
used by the application and a deterministic in-memory test adapter used by UI
tests. It supports configure, full-step, phased-step, snapshot, and destroy
operations. Numerical policy remains behind the C interface.

## Interaction Design

Each lesson combines short original explanations, equations, annotated C,
guided parameter changes, observation prompts, and checks. The final sandbox
provides unrestricted combinations within validated first-release features.

The main laboratory shows synchronized `Ez` and `Hy`, source/TFSF and probe
markers, material bands, terminations, time step, phase, and energy. Controls
include play, pause, reset, single step, phase step, playback speed, and an
optional waterfall view.

Normal experiments enforce the stable Courant range. A dedicated lesson may
unlock `Sc > 1` only after a warning; it caps cells and steps and stops on
non-finite fields or a configured magnitude threshold.

The layout is desktop-first, functional on tablets, and provides reading plus
simplified playback on phones. It supports keyboard controls, non-color-only
field identification, reduced motion, and accessible equation/code labels.

## Persistence and Privacy

The static site has no accounts or server database. Versioned `localStorage`
records completed lessons, check answers, and the most recent safe experiment.
Users can export and import this state as JSON. No personal information or
simulation telemetry is collected.

## Deployment

GitHub Actions builds native tests, WebAssembly, the web test suite, and the
static site. GitHub Pages publishes only after every required check passes.
The workflow must account for the repository subpath and verify direct route
loading, WASM MIME behavior, and worker asset paths.

## Physics Acceptance

Visual plausibility is not evidence of correctness. Required automated gates
are:

- the existing additive/Mur regression remains unchanged;
- point-source and termination combinations remain valid;
- TFSF incident leakage is measured in the scattered-field region;
- dielectric reflection and transmission agree with the normal-incidence
  Fresnel solution;
- lossy-medium attenuation agrees with an analytic or independently computed
  reference;
- matched-layer reflection is measured and compared with PMC and Mur;
- native and WebAssembly snapshots agree within measured floating-point
  tolerance;
- full and phased stepping produce the same completed-step state;
- safety limits stop unstable experiments without hanging the worker.

Tolerance values are established from deterministic reference simulations and
recorded with the tests. They are not selected to make a failing result pass.

## Roadmap

After the first release, add harmonic and Ricker sources, running DFT and
frequency diagnostics, 2D TMz/TEz, true 2D PML, 3D grids, dispersive materials,
parallel solvers, acoustic FDTD, and near-to-far-field transforms. Each topic
must add physics verification before an interactive lesson is published.
