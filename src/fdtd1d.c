#include "ufdtd/fdtd1d.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>

struct FDTD1D {
    struct FDTD1DConfig config;
    double *ez;
    double *hy;
    size_t completed_steps;
};

struct FDTD1DBoundaryHistory {
    double left;
    double left_neighbor;
    double right;
    double right_neighbor;
};

static enum FDTD1DStatus invalid(
    char *error,
    size_t error_size,
    const char *message
)
{
    if (error != NULL && error_size > 0U) {
        snprintf(error, error_size, "%s", message);
    }
    return FDTD1D_INVALID_ARGUMENT;
}

static double resolved_courant(const struct FDTD1DConfig *config)
{
    if (config->scale == FDTD1D_SI) {
        return FDTD1D_C0 * config->dt / config->dx;
    }
    return config->courant;
}

static enum FDTD1DStatus validate_shape(
    const struct FDTD1DConfig *config,
    char *error,
    size_t error_size
)
{
    if (config->grid_size < 5U) {
        return invalid(error, error_size, "grid_size must be at least 5");
    }
    if (config->time_steps == 0U) {
        return invalid(error, error_size, "time_steps must be positive");
    }
    if (config->snapshot_interval == 0U) {
        return invalid(error, error_size, "snapshot_interval must be positive");
    }
    if (config->probe_index >= config->grid_size) {
        return invalid(error, error_size, "probe_index is outside the grid");
    }
    return FDTD1D_OK;
}

static enum FDTD1DStatus validate_enums(
    const struct FDTD1DConfig *config,
    char *error,
    size_t error_size
)
{
    if (config->source.injection != FDTD1D_SOURCE_HARD
        && config->source.injection != FDTD1D_SOURCE_ADDITIVE) {
        return invalid(error, error_size, "source injection is invalid");
    }
    if (config->boundary != FDTD1D_BOUNDARY_PMC
        && config->boundary != FDTD1D_BOUNDARY_MUR1) {
        return invalid(error, error_size, "boundary is invalid");
    }
    if (config->scale != FDTD1D_NORMALIZED
        && config->scale != FDTD1D_SI) {
        return invalid(error, error_size, "scale is invalid");
    }
    return FDTD1D_OK;
}

static enum FDTD1DStatus validate_source(
    const struct FDTD1DConfig *config,
    char *error,
    size_t error_size
)
{
    if (!isfinite(config->source.delay_steps)
        || config->source.delay_steps < 0.0) {
        return invalid(error, error_size, "source delay must be finite and nonnegative");
    }
    if (!isfinite(config->source.width_steps)
        || config->source.width_steps <= 0.0) {
        return invalid(error, error_size, "source width must be finite and positive");
    }
    if (!isfinite(config->source.amplitude)) {
        return invalid(error, error_size, "source amplitude must be finite");
    }
    if (config->source.index < 2U
        || config->source.index > config->grid_size - 3U) {
        return invalid(error, error_size, "source is too close to a boundary");
    }
    return FDTD1D_OK;
}

static enum FDTD1DStatus validate_scale(
    const struct FDTD1DConfig *config,
    char *error,
    size_t error_size
)
{
    if (config->scale == FDTD1D_SI
        && (!isfinite(config->dx) || config->dx <= 0.0
            || !isfinite(config->dt) || config->dt <= 0.0)) {
        return invalid(error, error_size, "SI dx and dt must be finite and positive");
    }
    const double courant = resolved_courant(config);
    if (!isfinite(courant) || courant <= 0.0 || courant > 1.0) {
        return invalid(error, error_size, "Courant number must satisfy 0 < Sc <= 1");
    }
    return FDTD1D_OK;
}

struct FDTD1DConfig fdtd1d_default_normalized(void)
{
    return (struct FDTD1DConfig) {
        .scale = FDTD1D_NORMALIZED,
        .boundary = FDTD1D_BOUNDARY_MUR1,
        .source = {
            .injection = FDTD1D_SOURCE_ADDITIVE,
            .index = 50U,
            .delay_steps = 30.0,
            .width_steps = 10.0,
            .amplitude = 1.0
        },
        .grid_size = 200U,
        .time_steps = 450U,
        .probe_index = 100U,
        .snapshot_interval = 10U,
        .courant = 1.0,
        .dx = 1.0,
        .dt = 1.0
    };
}

struct FDTD1DConfig fdtd1d_default_si(double dx, double dt)
{
    struct FDTD1DConfig config = fdtd1d_default_normalized();
    config.scale = FDTD1D_SI;
    config.dx = dx;
    config.dt = dt;
    config.courant = FDTD1D_C0 * dt / dx;
    return config;
}

enum FDTD1DStatus fdtd1d_validate_config(
    const struct FDTD1DConfig *config,
    char *error,
    size_t error_size
)
{
    if (config == NULL) {
        return invalid(error, error_size, "config must not be null");
    }
    if (error != NULL && error_size > 0U) {
        error[0] = '\0';
    }
    enum FDTD1DStatus status = validate_enums(config, error, error_size);
    if (status == FDTD1D_OK) {
        status = validate_shape(config, error, error_size);
    }
    if (status == FDTD1D_OK) {
        status = validate_source(config, error, error_size);
    }
    return status == FDTD1D_OK
        ? validate_scale(config, error, error_size)
        : status;
}

static void configure_resolved_scale(struct FDTD1D *simulation)
{
    if (simulation->config.scale == FDTD1D_NORMALIZED) {
        simulation->config.dx = 1.0;
        simulation->config.dt = simulation->config.courant;
    } else {
        simulation->config.courant = resolved_courant(&simulation->config);
    }
}

struct FDTD1D *fdtd1d_create(
    const struct FDTD1DConfig *config,
    char *error,
    size_t error_size
)
{
    if (fdtd1d_validate_config(config, error, error_size) != FDTD1D_OK) {
        return NULL;
    }
    struct FDTD1D *simulation = calloc(1U, sizeof(*simulation));
    if (simulation == NULL) {
        invalid(error, error_size, "cannot allocate the simulation state");
        return NULL;
    }
    simulation->config = *config;
    configure_resolved_scale(simulation);
    simulation->ez = calloc(config->grid_size, sizeof(*simulation->ez));
    simulation->hy = calloc(config->grid_size, sizeof(*simulation->hy));
    if (simulation->ez == NULL || simulation->hy == NULL) {
        fdtd1d_destroy(simulation);
        invalid(error, error_size, "cannot allocate the field arrays");
        return NULL;
    }
    return simulation;
}

void fdtd1d_destroy(struct FDTD1D *simulation)
{
    if (simulation != NULL) {
        free(simulation->ez);
        free(simulation->hy);
        free(simulation);
    }
}

static double gaussian_source(const struct FDTD1D *simulation)
{
    const double offset =
        ((double)simulation->completed_steps
            - simulation->config.source.delay_steps)
        / simulation->config.source.width_steps;
    return simulation->config.source.amplitude * exp(-(offset * offset));
}

static void update_magnetic(struct FDTD1D *simulation)
{
    const size_t size = simulation->config.grid_size;
    const double coefficient = simulation->config.courant / FDTD1D_ETA0;
    for (size_t index = 0U; index < size - 1U; ++index) {
        simulation->hy[index] += coefficient
            * (simulation->ez[index + 1U] - simulation->ez[index]);
    }
}

static void update_electric_interior(struct FDTD1D *simulation)
{
    const size_t size = simulation->config.grid_size;
    const double coefficient = simulation->config.courant * FDTD1D_ETA0;
    for (size_t index = 1U; index < size - 1U; ++index) {
        simulation->ez[index] += coefficient
            * (simulation->hy[index] - simulation->hy[index - 1U]);
    }
}

static void apply_hard_source(
    struct FDTD1D *simulation,
    double value
)
{
    simulation->ez[simulation->config.source.index] = value;
}

static void apply_additive_source(
    struct FDTD1D *simulation,
    double value
)
{
    simulation->ez[simulation->config.source.index] += value;
}

static void apply_source(struct FDTD1D *simulation)
{
    const double value = gaussian_source(simulation);

    switch (simulation->config.source.injection) {
    case FDTD1D_SOURCE_HARD:
        apply_hard_source(simulation, value);
        break;
    case FDTD1D_SOURCE_ADDITIVE:
        apply_additive_source(simulation, value);
        break;
    }
}

static struct FDTD1DBoundaryHistory capture_boundary_history(
    const struct FDTD1D *simulation
)
{
    const size_t last = simulation->config.grid_size - 1U;
    return (struct FDTD1DBoundaryHistory) {
        simulation->ez[0],
        simulation->ez[1],
        simulation->ez[last],
        simulation->ez[last - 1U]
    };
}

static void apply_first_order_abc(
    struct FDTD1D *simulation,
    const struct FDTD1DBoundaryHistory *history
)
{
    const size_t last = simulation->config.grid_size - 1U;
    const double coefficient =
        (simulation->config.courant - 1.0)
        / (simulation->config.courant + 1.0);
    simulation->ez[0] = history->left_neighbor
        + coefficient * (simulation->ez[1] - history->left);
    simulation->ez[last] = history->right_neighbor
        + coefficient * (simulation->ez[last - 1U] - history->right);
}

static void apply_pmc_boundary(struct FDTD1D *simulation)
{
    const size_t last = simulation->config.grid_size - 1U;
    simulation->ez[0] = simulation->ez[1];
    simulation->ez[last] = simulation->ez[last - 1U];
}

static void apply_boundary(
    struct FDTD1D *simulation,
    const struct FDTD1DBoundaryHistory *history
)
{
    switch (simulation->config.boundary) {
    case FDTD1D_BOUNDARY_PMC:
        apply_pmc_boundary(simulation);
        break;
    case FDTD1D_BOUNDARY_MUR1:
        apply_first_order_abc(simulation, history);
        break;
    }
}

static int fields_are_finite(const struct FDTD1D *simulation)
{
    for (size_t index = 0U; index < simulation->config.grid_size; ++index) {
        if (!isfinite(simulation->ez[index])
            || !isfinite(simulation->hy[index])) {
            return 0;
        }
    }
    return 1;
}

enum FDTD1DStatus fdtd1d_step(struct FDTD1D *simulation)
{
    if (simulation == NULL) {
        return FDTD1D_INVALID_ARGUMENT;
    }
    if (simulation->completed_steps >= simulation->config.time_steps) {
        return FDTD1D_FINISHED;
    }
    const struct FDTD1DBoundaryHistory history =
        capture_boundary_history(simulation);
    update_magnetic(simulation);
    update_electric_interior(simulation);
    apply_source(simulation);
    apply_boundary(simulation, &history);
    if (!fields_are_finite(simulation)) {
        return FDTD1D_NUMERIC_ERROR;
    }
    ++simulation->completed_steps;
    return FDTD1D_OK;
}

const double *fdtd1d_electric(const struct FDTD1D *simulation)
{
    return simulation == NULL ? NULL : simulation->ez;
}

const double *fdtd1d_magnetic(const struct FDTD1D *simulation)
{
    return simulation == NULL ? NULL : simulation->hy;
}

size_t fdtd1d_current_step(const struct FDTD1D *simulation)
{
    if (simulation == NULL || simulation->completed_steps == 0U) {
        return 0U;
    }
    return simulation->completed_steps - 1U;
}

double fdtd1d_time(const struct FDTD1D *simulation)
{
    if (simulation == NULL || simulation->completed_steps == 0U) {
        return 0.0;
    }
    return (double)(simulation->completed_steps - 1U) * simulation->config.dt;
}

double fdtd1d_position(const struct FDTD1D *simulation, size_t index)
{
    if (simulation == NULL || index >= simulation->config.grid_size) {
        return NAN;
    }
    return (double)index * simulation->config.dx;
}

double fdtd1d_courant(const struct FDTD1D *simulation)
{
    return simulation == NULL ? NAN : simulation->config.courant;
}

const struct FDTD1DConfig *fdtd1d_config(
    const struct FDTD1D *simulation
)
{
    return simulation == NULL ? NULL : &simulation->config;
}
