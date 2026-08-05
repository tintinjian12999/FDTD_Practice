# Interactive FDTD Textbook Implementation Plan

## Objective

Deliver the approved first public release as a sequence of independently
testable vertical slices. Every slice crosses the public C interface first;
CLI, WebAssembly, and web adapters follow only after the numerical behavior is
verified.

## Fixed Decisions

- Original Traditional Chinese content with English technical terms.
- One-dimensional first release with point source, TFSF, nondispersive
  material regions, PMC, Mur1, and matched absorbing layers.
- One excitation per simulation.
- Independent left/right terminations.
- Native and WebAssembly builds share the C numerical implementation.
- React, TypeScript, Vite, MDX, KaTeX, Web Worker, and Canvas 2D.
- Static GitHub Pages deployment, local-only progress, no arbitrary C
  execution.
- MIT software and CC BY-SA 4.0 original content.

## Vertical Slices

### 1. Domain Interface and Compatibility Adapter

1. Add failing public-interface tests for nested experiment defaults,
   validation, and the four teaching phases.
2. Replace the experimental flat configuration with domain, excitation,
   materials, terminations, observations, and safety structs.
3. Keep current default CLI behavior through an adapter and preserve the
   additive/Mur numerical golden reference.
4. Commit: `refactor: define the FDTD experiment domain model`.

### 2. Material Regions

1. Add invalid-region, vacuum-equivalence, dielectric-interface, and lossy
   coefficient tests.
2. Precompute electric and magnetic update coefficients from material regions.
3. Verify normalized/SI equivalence and analytic loss behavior.
4. Extend schema output and strict loader.
5. Commit: `feat: add nondispersive material regions`.

### 3. Independent Terminations

1. Add left/right asymmetric PMC and Mur tests.
2. Refactor termination history per side without exposing internal state.
3. Extend CLI, schema, and GUI adapters while preserving symmetric shortcuts.
4. Commit: `feat: support independent grid terminations`.

### 4. One-Dimensional TFSF

1. Add failing right-going and left-going incident-wave tests.
2. Implement magnetic and electric seam corrections as internal phase logic.
3. Measure scattered-region leakage and interface Fresnel coefficients.
4. Add CLI/schema representations and presets.
5. Commit: `feat: add one-dimensional TFSF excitation`.

### 5. Matched Absorbing Layer

1. Add validation and generated-profile tests.
2. Implement polynomially graded matched electric/magnetic conductivity.
3. Measure reflection versus PMC and Mur over representative pulse spectra.
4. Name output and documentation precisely as a 1D PML foundation.
5. Commit: `feat: add graded matched absorbing layers`.

### 6. Emscripten Adapter

1. Add an Emscripten CMake preset and a narrow exported C ABI.
2. Marshal validated configuration and copy read-only field snapshots.
3. Run the module in a Web Worker and add cancellation/safety limits.
4. Compare native and WASM golden snapshots.
5. Commit: `feat: compile the FDTD core to WebAssembly`.

### 7. Web Foundation

1. Scaffold `web/` with React, TypeScript, Vite, Vitest, MDX, and KaTeX.
2. Implement navigation, responsive layout, theme tokens, error handling, and
   versioned local progress export/import.
3. Define `SimulationBackend` and deterministic test adapter.
4. Commit: `feat: scaffold the interactive textbook`.

### 8. One-Dimensional Laboratory

1. Build the parameter model and validation messages.
2. Render synchronized `Ez`/`Hy`, markers, materials, energy, and waterfall
   data with Canvas 2D.
3. Add play, pause, reset, full-step, phase-step, speed, reduced-motion, and
   guarded-instability behavior.
4. Add UI and browser tests through the backend seam.
5. Commit: `feat: add the interactive one-dimensional lab`.

### 9. Guided Curriculum

1. Write the 17 first-release MDX lessons using original prose and diagrams.
2. Add equation, annotated-code, prompt, check, and experiment content blocks.
3. Add bibliographic chapter/section mapping without copying source material.
4. Verify links, headings, formulas, code labels, mobile reading, and keyboard
   navigation.
5. Commit in coherent lesson groups rather than one monolithic content commit.

### 10. Licensing and Deployment

1. Add MIT and CC BY-SA licensing with a clear scope notice.
2. Add GitHub Actions for native, Python, WASM, Vitest, browser smoke, and
   production build checks.
3. Configure GitHub Pages repository-base routing and asset paths.
4. Add README setup, development, authoring, and deployment instructions.
5. Commit: `ci: publish the interactive textbook to GitHub Pages`.

## Self-Review Gates

After each numerical slice:

- inspect the public interface for unnecessary caller knowledge;
- compare requirements against the design spec;
- run Debug and Release CTest with warnings as errors;
- run Python integration/schema tests;
- record reference provenance and tolerance rationale.

Before publishing:

- run the complete native, WASM, web, browser, accessibility, and production
  build workflow from a clean configuration;
- review the branch along independent Standards and Spec axes;
- fix all material findings;
- confirm no PDF, scanned book pages, or unlicensed book assets are tracked;
- commit intentionally and push `codex/interactive-fdtd-textbook`.

## Completion Definition

The first release is complete only when all 17 lessons are reachable, every
interactive lab uses the shared WebAssembly core, all required physics gates
pass, GitHub Pages loads the site and worker from the repository subpath, and
the published repository contains only original or explicitly licensed
content.
