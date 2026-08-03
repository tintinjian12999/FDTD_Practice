# FDTD Source and Boundary Separation Implementation Plan

## Objective

Implement the approved source/boundary separation as vertical TDD slices while
preserving the existing additive/Mur numerical behavior.

## Confirmed Test Seams

- Public C interface: config construction, validation, stepping, and field
  observation through `include/ufdtd/fdtd1d.h`.
- CLI and output interface: process arguments, exit status, CSV, and schema-v2
  `run.json`.
- GUI model interface: parameter validation and generated solver command.
- GUI application behavior: selector state and the non-blocking hard-source
  warning through an isolated Tk process.

## Vertical Slices

1. Replace the public mode enum with source and boundary configuration. Add one
   failing default/validation test, implement the minimum interface change, and
   restore the core test build.
2. Add a failing public-interface test for hard and additive injection, then
   implement common interior-E updating and source dispatch.
3. Add a failing PMC behavior test, then implement explicit symmetric PMC
   endpoints. Preserve and rerun the existing Mur residual and normalized/SI
   equivalence tests.
4. Add failing CLI tests for `--source`, `--boundary`, removal of `--mode`, and
   all four combinations. Implement strict parsing and defaults.
5. Add a failing schema-v2 loader/output test. Implement nested source and
   boundary metadata, then update strict visualization loading.
6. Add failing GUI-model tests for independent selectors and source placement.
   Implement command generation and validation.
7. Add a failing isolated GUI behavior test for selector construction and the
   hard-source warning. Update the Tk interface without changing runner or plot
   lifecycle behavior.
8. Update README, CLI help, changelog, design references, and examples.
9. Run targeted tests after every slice, then run the full verification script
   in Debug and Release. Review the complete branch diff against the approved
   design, fix material findings, commit intentionally, and push the branch.

## Commit Strategy

- `docs: design independent FDTD source and boundary selection`
- `refactor: separate FDTD source and boundary configuration`
- `feat: expose independent source and boundary CLI options`
- `feat: emit FDTD metadata schema version 2`
- `feat: separate source and boundary GUI controls`
- `docs: document independent source and boundary experiments`
- review fixes, if required, in a focused final commit
