#include "ufdtd/fdtd1d_wasm.h"

#include <stdio.h>
#include <stdlib.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define UFDTD_WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define UFDTD_WASM_EXPORT
#endif

#define UFDTD_WASM_MAX_MATERIALS 16U

struct FDTD1DWasmSession {
    struct FDTD1DExperimentConfig config;
    struct FDTD1DMaterialRegion materials[UFDTD_WASM_MAX_MATERIALS];
    size_t material_count;
    struct FDTD1D *simulation;
    char error[256];
};

static int reject_change_after_start(struct FDTD1DWasmSession *session)
{
    if (session == NULL) {
        return FDTD1D_INVALID_ARGUMENT;
    }
    if (session->simulation != NULL) {
        snprintf(session->error, sizeof(session->error),
            "%s", "configuration cannot change after start");
        return FDTD1D_INVALID_ARGUMENT;
    }
    return FDTD1D_OK;
}

static struct FDTD1DWasmSession *create_session(
    size_t grid_size,
    size_t time_steps
)
{
    struct FDTD1DWasmSession *session = calloc(1U, sizeof(*session));
    if (session == NULL) {
        return NULL;
    }
    session->config = fdtd1d_default_experiment_normalized();
    session->config.domain.grid_size = grid_size;
    session->config.domain.time_steps = time_steps;
    session->config.observation.probe_index = grid_size / 2U;
    session->config.excitation.point.index = grid_size / 4U;
    return session;
}

UFDTD_WASM_EXPORT struct FDTD1DWasmSession *ufdtd_wasm_create_normalized(
    size_t grid_size,
    size_t time_steps,
    double courant
)
{
    struct FDTD1DWasmSession *session =
        create_session(grid_size, time_steps);
    if (session != NULL) {
        session->config.domain.courant = courant;
    }
    return session;
}

UFDTD_WASM_EXPORT struct FDTD1DWasmSession *ufdtd_wasm_create_si(
    size_t grid_size,
    size_t time_steps,
    double dx,
    double dt
)
{
    struct FDTD1DWasmSession *session =
        create_session(grid_size, time_steps);
    if (session != NULL) {
        session->config.domain.scale = FDTD1D_SI;
        session->config.domain.dx = dx;
        session->config.domain.dt = dt;
        session->config.domain.courant = FDTD1D_C0 * dt / dx;
    }
    return session;
}

UFDTD_WASM_EXPORT int ufdtd_wasm_set_point_excitation(
    struct FDTD1DWasmSession *session,
    enum FDTD1DSourceInjection injection,
    size_t index,
    double delay_steps,
    double width_steps,
    double amplitude
)
{
    const int status = reject_change_after_start(session);
    if (status != FDTD1D_OK) {
        return status;
    }
    session->config.excitation.type = FDTD1D_EXCITATION_POINT;
    session->config.excitation.point = (struct FDTD1DPointExcitationConfig) {
        .injection = injection,
        .index = index,
        .gaussian = {delay_steps, width_steps, amplitude}
    };
    return FDTD1D_OK;
}

UFDTD_WASM_EXPORT int ufdtd_wasm_set_tfsf_excitation(
    struct FDTD1DWasmSession *session,
    enum FDTD1DPropagationDirection direction,
    size_t seam_index,
    double delay_steps,
    double width_steps,
    double amplitude
)
{
    const int status = reject_change_after_start(session);
    if (status != FDTD1D_OK) {
        return status;
    }
    session->config.excitation.type = FDTD1D_EXCITATION_TFSF;
    session->config.excitation.tfsf = (struct FDTD1DTFSFExcitationConfig) {
        .direction = direction,
        .seam_index = seam_index,
        .gaussian = {delay_steps, width_steps, amplitude}
    };
    return FDTD1D_OK;
}

UFDTD_WASM_EXPORT int ufdtd_wasm_add_material(
    struct FDTD1DWasmSession *session,
    size_t start_index,
    size_t end_index,
    double epsilon_r,
    double mu_r,
    double sigma_e,
    double sigma_m
)
{
    const int status = reject_change_after_start(session);
    if (status != FDTD1D_OK) {
        return status;
    }
    if (session->material_count >= UFDTD_WASM_MAX_MATERIALS) {
        snprintf(session->error, sizeof(session->error),
            "%s", "the browser adapter supports at most 16 material regions");
        return FDTD1D_INVALID_ARGUMENT;
    }
    session->materials[session->material_count++] =
        (struct FDTD1DMaterialRegion) {
            .start_index = start_index,
            .end_index = end_index,
            .material = {epsilon_r, mu_r, sigma_e, sigma_m}
        };
    return FDTD1D_OK;
}

UFDTD_WASM_EXPORT int ufdtd_wasm_set_termination(
    struct FDTD1DWasmSession *session,
    enum FDTD1DWasmSide side,
    enum FDTD1DTerminationType type,
    size_t thickness,
    unsigned grading_order,
    double target_reflection
)
{
    const int status = reject_change_after_start(session);
    if (status != FDTD1D_OK) {
        return status;
    }
    if (side != FDTD1D_WASM_LEFT && side != FDTD1D_WASM_RIGHT) {
        snprintf(session->error, sizeof(session->error),
            "%s", "termination side is invalid");
        return FDTD1D_INVALID_ARGUMENT;
    }
    struct FDTD1DTerminationConfig termination = {
        .type = type,
        .matched_layer = {thickness, grading_order, target_reflection}
    };
    if (side == FDTD1D_WASM_LEFT) {
        session->config.left_termination = termination;
    } else {
        session->config.right_termination = termination;
    }
    return FDTD1D_OK;
}

UFDTD_WASM_EXPORT int ufdtd_wasm_set_safety(
    struct FDTD1DWasmSession *session,
    int allow_unstable_courant,
    double maximum_field_magnitude
)
{
    const int status = reject_change_after_start(session);
    if (status != FDTD1D_OK) {
        return status;
    }
    session->config.safety.allow_unstable_courant = allow_unstable_courant;
    session->config.safety.maximum_field_magnitude = maximum_field_magnitude;
    return FDTD1D_OK;
}

UFDTD_WASM_EXPORT int ufdtd_wasm_start(
    struct FDTD1DWasmSession *session
)
{
    if (session == NULL || session->simulation != NULL) {
        return FDTD1D_INVALID_ARGUMENT;
    }
    session->config.materials = session->material_count == 0U
        ? NULL
        : session->materials;
    session->config.material_count = session->material_count;
    session->simulation = fdtd1d_create_experiment(
        &session->config, session->error, sizeof(session->error)
    );
    return session->simulation == NULL ? FDTD1D_INVALID_ARGUMENT : FDTD1D_OK;
}

UFDTD_WASM_EXPORT int ufdtd_wasm_step(struct FDTD1DWasmSession *session)
{
    return session == NULL || session->simulation == NULL
        ? FDTD1D_INVALID_ARGUMENT
        : fdtd1d_step(session->simulation);
}

UFDTD_WASM_EXPORT int ufdtd_wasm_advance_phase(
    struct FDTD1DWasmSession *session
)
{
    return session == NULL || session->simulation == NULL
        ? FDTD1D_INVALID_ARGUMENT
        : fdtd1d_advance_phase(session->simulation);
}

UFDTD_WASM_EXPORT const double *ufdtd_wasm_electric(
    const struct FDTD1DWasmSession *session
)
{
    return session == NULL ? NULL : fdtd1d_electric(session->simulation);
}

UFDTD_WASM_EXPORT const double *ufdtd_wasm_magnetic(
    const struct FDTD1DWasmSession *session
)
{
    return session == NULL ? NULL : fdtd1d_magnetic(session->simulation);
}

UFDTD_WASM_EXPORT size_t ufdtd_wasm_grid_size(
    const struct FDTD1DWasmSession *session
)
{
    return session == NULL ? 0U : session->config.domain.grid_size;
}

UFDTD_WASM_EXPORT size_t ufdtd_wasm_current_step(
    const struct FDTD1DWasmSession *session
)
{
    return session == NULL || session->simulation == NULL
        ? 0U
        : fdtd1d_current_step(session->simulation);
}

UFDTD_WASM_EXPORT int ufdtd_wasm_phase(
    const struct FDTD1DWasmSession *session
)
{
    return session == NULL || session->simulation == NULL
        ? FDTD1D_PHASE_MAGNETIC
        : fdtd1d_phase(session->simulation);
}

UFDTD_WASM_EXPORT const char *ufdtd_wasm_error(
    const struct FDTD1DWasmSession *session
)
{
    return session == NULL ? "session is null" : session->error;
}

UFDTD_WASM_EXPORT void ufdtd_wasm_destroy(
    struct FDTD1DWasmSession *session
)
{
    if (session != NULL) {
        fdtd1d_destroy(session->simulation);
        free(session);
    }
}
