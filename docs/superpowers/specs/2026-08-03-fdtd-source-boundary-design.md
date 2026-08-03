# FDTD Source and Boundary Separation Design

## Status

Approved through the 2026-08-03 design interview. This is an intentional
breaking change to the experimental one-dimensional solver interface and its
metadata schema.

## Goal

Separate field-source injection from domain termination so callers can choose
each concern independently. The first version supports this complete matrix:

| Source injection | Boundary |
| --- | --- |
| hard | PMC |
| hard | first-order Mur |
| additive | PMC |
| additive | first-order Mur |

TFSF, PEC, second-order Mur, PML/CPML, asymmetric boundaries, selectable
waveforms, impressed-current sources, and ports are deferred.

## Public C Interface

Remove `enum FDTD1DMode`. Add these public types:

```c
enum FDTD1DSourceInjection {
    FDTD1D_SOURCE_HARD,
    FDTD1D_SOURCE_ADDITIVE
};

enum FDTD1DBoundaryType {
    FDTD1D_BOUNDARY_PMC,
    FDTD1D_BOUNDARY_MUR1
};

struct FDTD1DSourceConfig {
    enum FDTD1DSourceInjection injection;
    size_t index;
    double delay_steps;
    double width_steps;
    double amplitude;
};
```

`struct FDTD1DConfig` contains `source` and `boundary` fields. The source
parameters are grouped because they share invariants. Boundary remains an enum
until a boundary implementation has additional caller-controlled parameters.
No public callbacks or function pointers are added; `fdtd1d_create()` and
`fdtd1d_step()` remain the module interface.

Both default constructors select additive injection and first-order Mur.

## Source Semantics

The only waveform is Gaussian:

```text
g(n) = amplitude * exp(-((n - delay_steps) / width_steps)^2)
```

Hard injection continuously enforces `Ez[source.index] = g(n)` for the entire
simulation. It is deliberately non-transparent and may reflect returning
waves. Additive injection applies `Ez[source.index] += g(n)`.

Both injections require an interior source:

```text
2 <= source.index <= grid_size - 3
```

The book-faithful hard source at grid index zero remains only in
`book_1d_bare_bones`; the reusable solver does not special-case it.

## Boundary Semantics

One boundary selection applies to both ends of the grid.

PMC is an explicit first-order magnetic symmetry condition:

```text
Ez[0] = Ez[1]
Ez[grid_size - 1] = Ez[grid_size - 2]
```

First-order Mur retains the existing coefficient and history convention:

```text
coefficient = (courant - 1) / (courant + 1)
```

The existing additive/Mur field evolution must remain numerically equivalent.

## Time-Step Order

Each `fdtd1d_step()` performs this sequence:

1. Capture old boundary electric fields.
2. Update magnetic fields.
3. Update interior electric fields.
4. Evaluate the Gaussian waveform.
5. Apply hard or additive injection.
6. Apply PMC or first-order Mur at both ends.
7. Reject non-finite fields.
8. Increment the completed-step count.

Named static functions and centralized enum switches keep dispatch readable.

## CLI

Remove `--mode`. Add:

```text
--source hard|additive
--boundary pmc|mur1
```

Both options are optional and default to `additive` and `mur1`. Unknown,
duplicate, incomplete, and legacy `--mode` options are rejected.

## Metadata Schema Version 2

`run.json` removes `mode` and records nested source and boundary objects:

```json
{
  "schema_version": 2,
  "source": {
    "injection": "additive",
    "waveform": "gaussian",
    "index": 50,
    "delay_steps": 30,
    "width_steps": 10,
    "amplitude": 1
  },
  "boundary": {
    "type": "mur1"
  }
}
```

Other grid, scale, probe, and sampling metadata remain top-level. The Python
loader accepts schema version 2 only.

## GUI

Replace the Mode combobox with independent Source and Boundary comboboxes.
Hard injection shows a non-blocking bilingual warning that it continuously
overwrites the source cell and can reflect returning waves. Selecting hard no
longer changes the source index.

## Verification

Tests exercise the public C interface, CLI/schema output, and GUI model seam.
Every source/boundary combination must pass core and CLI end-to-end tests.
Additional requirements are:

- source placement and enum validation;
- hard enforcement and additive preservation semantics;
- PMC endpoint equality and non-inverted reflection;
- Mur residual behavior;
- additive/Mur regression equivalence within `1e-12` when exact comparison is
  unavailable;
- schema version 2 strict loading;
- GUI command construction, warning state, and pre-launch validation;
- full Debug, Release, CTest, Pytest, GUI, numerical, and visualization checks.
