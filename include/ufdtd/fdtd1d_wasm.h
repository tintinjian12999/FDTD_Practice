#ifndef UFDTD_FDTD1D_WASM_H
#define UFDTD_FDTD1D_WASM_H

#include "ufdtd/fdtd1d.h"

#include <stddef.h>

enum FDTD1DWasmSide {
    FDTD1D_WASM_LEFT,
    FDTD1D_WASM_RIGHT
};

struct FDTD1DWasmSession;

struct FDTD1DWasmSession *ufdtd_wasm_create_normalized(
    size_t grid_size,
    size_t time_steps,
    double courant
);
struct FDTD1DWasmSession *ufdtd_wasm_create_si(
    size_t grid_size,
    size_t time_steps,
    double dx,
    double dt
);
int ufdtd_wasm_set_point_excitation(
    struct FDTD1DWasmSession *session,
    enum FDTD1DSourceInjection injection,
    size_t index,
    double delay_steps,
    double width_steps,
    double amplitude
);
int ufdtd_wasm_set_tfsf_excitation(
    struct FDTD1DWasmSession *session,
    enum FDTD1DPropagationDirection direction,
    size_t seam_index,
    double delay_steps,
    double width_steps,
    double amplitude
);
int ufdtd_wasm_add_material(
    struct FDTD1DWasmSession *session,
    size_t start_index,
    size_t end_index,
    double epsilon_r,
    double mu_r,
    double sigma_e,
    double sigma_m
);
int ufdtd_wasm_set_termination(
    struct FDTD1DWasmSession *session,
    enum FDTD1DWasmSide side,
    enum FDTD1DTerminationType type,
    size_t thickness,
    unsigned grading_order,
    double target_reflection
);
int ufdtd_wasm_set_safety(
    struct FDTD1DWasmSession *session,
    int allow_unstable_courant,
    double maximum_field_magnitude
);
int ufdtd_wasm_start(struct FDTD1DWasmSession *session);
int ufdtd_wasm_step(struct FDTD1DWasmSession *session);
int ufdtd_wasm_advance_phase(struct FDTD1DWasmSession *session);
const double *ufdtd_wasm_electric(const struct FDTD1DWasmSession *session);
const double *ufdtd_wasm_magnetic(const struct FDTD1DWasmSession *session);
size_t ufdtd_wasm_grid_size(const struct FDTD1DWasmSession *session);
size_t ufdtd_wasm_current_step(const struct FDTD1DWasmSession *session);
int ufdtd_wasm_phase(const struct FDTD1DWasmSession *session);
const char *ufdtd_wasm_error(const struct FDTD1DWasmSession *session);
void ufdtd_wasm_destroy(struct FDTD1DWasmSession *session);

#endif
