#include "ufdtd/fdtd1d.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>

struct FDTD1DBoundaryHistory {
    double left;
    double left_neighbor;
    double right;
    double right_neighbor;
};

struct FDTD1D {
    struct FDTD1DConfig config;
    double *ez;
    double *hy;
    double *ceze;
    double *cezh;
    double *chyh;
    double *chye;
    size_t completed_steps;
    enum FDTD1DPhase phase;
    enum FDTD1DExcitationType excitation_type;
    struct FDTD1DTFSFExcitationConfig tfsf;
    enum FDTD1DTerminationType left_termination;
    enum FDTD1DTerminationType right_termination;
    struct FDTD1DMatchedLayerConfig left_matched_layer;
    struct FDTD1DMatchedLayerConfig right_matched_layer;
    double maximum_field_magnitude;
    struct FDTD1DBoundaryHistory boundary_history;
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

struct FDTD1DExperimentConfig fdtd1d_default_experiment_normalized(void)
{
    return (struct FDTD1DExperimentConfig) {
        .domain = {
            .scale = FDTD1D_NORMALIZED,
            .grid_size = 200U,
            .time_steps = 450U,
            .courant = 1.0,
            .dx = 1.0,
            .dt = 1.0
        },
        .excitation = {
            .type = FDTD1D_EXCITATION_POINT,
            .point = {
                .injection = FDTD1D_SOURCE_ADDITIVE,
                .index = 50U,
                .gaussian = {
                    .delay_steps = 30.0,
                    .width_steps = 10.0,
                    .amplitude = 1.0
                }
            }
        },
        .materials = NULL,
        .material_count = 0U,
        .left_termination = {
            .type = FDTD1D_TERMINATION_MUR1
        },
        .right_termination = {
            .type = FDTD1D_TERMINATION_MUR1
        },
        .observation = {
            .probe_index = 100U,
            .snapshot_interval = 10U
        },
        .safety = {
            .allow_unstable_courant = 0,
            .maximum_field_magnitude = 1.0e6
        }
    };
}

static int termination_is_supported(
    const struct FDTD1DTerminationConfig *termination
)
{
    return termination->type == FDTD1D_TERMINATION_PMC
        || termination->type == FDTD1D_TERMINATION_MUR1
        || termination->type == FDTD1D_TERMINATION_MATCHED_LAYER;
}

static enum FDTD1DStatus validate_matched_layer(
    const struct FDTD1DTerminationConfig *termination,
    size_t grid_size,
    char *error,
    size_t error_size
)
{
    if (!termination_is_supported(termination)) {
        return invalid(error, error_size, "termination type is invalid");
    }
    if (termination->type != FDTD1D_TERMINATION_MATCHED_LAYER) {
        return FDTD1D_OK;
    }
    const struct FDTD1DMatchedLayerConfig *layer =
        &termination->matched_layer;
    if (layer->thickness < 4U || layer->thickness > grid_size - 3U) {
        return invalid(error, error_size,
            "matched-layer thickness must be between 4 and grid_size - 3");
    }
    if (layer->grading_order == 0U || layer->grading_order > 8U) {
        return invalid(error, error_size,
            "matched-layer grading order must be between 1 and 8");
    }
    if (!isfinite(layer->target_reflection)
        || layer->target_reflection <= 0.0
        || layer->target_reflection >= 1.0) {
        return invalid(error, error_size,
            "matched-layer target reflection must be between 0 and 1");
    }
    return FDTD1D_OK;
}

static enum FDTD1DStatus validate_materials(
    const struct FDTD1DExperimentConfig *config,
    char *error,
    size_t error_size
)
{
    if ((config->materials == NULL) != (config->material_count == 0U)) {
        return invalid(error, error_size,
            "material pointer and count are inconsistent");
    }
    size_t previous_end = 0U;
    for (size_t index = 0U; index < config->material_count; ++index) {
        const struct FDTD1DMaterialRegion *region = &config->materials[index];
        const struct FDTD1DMaterialConfig *material = &region->material;
        if (region->start_index >= region->end_index
            || region->end_index > config->domain.grid_size
            || (index > 0U && region->start_index < previous_end)) {
            return invalid(error, error_size,
                "material regions must be ordered and non-overlapping");
        }
        if (!isfinite(material->epsilon_r) || material->epsilon_r <= 0.0
            || !isfinite(material->mu_r) || material->mu_r <= 0.0
            || !isfinite(material->sigma_e) || material->sigma_e < 0.0
            || !isfinite(material->sigma_m) || material->sigma_m < 0.0) {
            return invalid(error, error_size,
                "material values are outside their valid range");
        }
        previous_end = region->end_index;
    }
    return FDTD1D_OK;
}

static struct FDTD1DConfig legacy_config_from_experiment(
    const struct FDTD1DExperimentConfig *experiment
)
{
    struct FDTD1DConfig config = {
        .scale = experiment->domain.scale,
        .boundary = experiment->left_termination.type
                == FDTD1D_TERMINATION_PMC
            ? FDTD1D_BOUNDARY_PMC
            : FDTD1D_BOUNDARY_MUR1,
        .source = {
            .injection = FDTD1D_SOURCE_ADDITIVE,
            .index = experiment->excitation.type == FDTD1D_EXCITATION_POINT
                ? experiment->excitation.point.index
                : experiment->excitation.tfsf.seam_index,
            .delay_steps = 0.0,
            .width_steps = 1.0,
            .amplitude = 0.0
        },
        .grid_size = experiment->domain.grid_size,
        .time_steps = experiment->domain.time_steps,
        .probe_index = experiment->observation.probe_index,
        .snapshot_interval = experiment->observation.snapshot_interval,
        .courant = experiment->domain.courant,
        .dx = experiment->domain.dx,
        .dt = experiment->domain.dt
    };
    if (experiment->excitation.type == FDTD1D_EXCITATION_POINT) {
        config.source.injection = experiment->excitation.point.injection;
        config.source.delay_steps =
            experiment->excitation.point.gaussian.delay_steps;
        config.source.width_steps =
            experiment->excitation.point.gaussian.width_steps;
        config.source.amplitude =
            experiment->excitation.point.gaussian.amplitude;
    }
    return config;
}

static int gaussian_is_valid(const struct FDTD1DGaussianConfig *gaussian)
{
    return isfinite(gaussian->delay_steps) && gaussian->delay_steps >= 0.0
        && isfinite(gaussian->width_steps) && gaussian->width_steps > 0.0
        && isfinite(gaussian->amplitude);
}

enum FDTD1DStatus fdtd1d_validate_experiment(
    const struct FDTD1DExperimentConfig *config,
    char *error,
    size_t error_size
)
{
    if (config == NULL) {
        return invalid(error, error_size, "experiment must not be null");
    }
    const enum FDTD1DStatus material_status =
        validate_materials(config, error, error_size);
    if (material_status != FDTD1D_OK) {
        return material_status;
    }
    if (config->excitation.type == FDTD1D_EXCITATION_TFSF) {
        if (config->excitation.tfsf.direction != FDTD1D_PROPAGATE_RIGHT
            && config->excitation.tfsf.direction != FDTD1D_PROPAGATE_LEFT) {
            return invalid(error, error_size,
                "TFSF propagation direction is invalid");
        }
        if (config->excitation.tfsf.seam_index < 2U
            || config->excitation.tfsf.seam_index
                > config->domain.grid_size - 3U) {
            return invalid(error, error_size,
                "TFSF seam is too close to a termination");
        }
        if (!gaussian_is_valid(&config->excitation.tfsf.gaussian)) {
            return invalid(error, error_size,
                "TFSF Gaussian values are invalid");
        }
    } else if (config->excitation.type != FDTD1D_EXCITATION_POINT) {
        return invalid(error, error_size, "excitation type is invalid");
    }
    enum FDTD1DStatus termination_status = validate_matched_layer(
        &config->left_termination, config->domain.grid_size,
        error, error_size
    );
    if (termination_status == FDTD1D_OK) {
        termination_status = validate_matched_layer(
            &config->right_termination, config->domain.grid_size,
            error, error_size
        );
    }
    if (termination_status != FDTD1D_OK) {
        return termination_status;
    }
    const size_t left_reserved = config->left_termination.type
            == FDTD1D_TERMINATION_MATCHED_LAYER
        ? config->left_termination.matched_layer.thickness
        : 0U;
    const size_t right_reserved = config->right_termination.type
            == FDTD1D_TERMINATION_MATCHED_LAYER
        ? config->right_termination.matched_layer.thickness
        : 0U;
    if (left_reserved + right_reserved > config->domain.grid_size - 3U) {
        return invalid(error, error_size,
            "matched layers leave too few interior cells");
    }
    for (size_t index = 0U; index < config->material_count; ++index) {
        if (config->materials[index].start_index < left_reserved
            || config->materials[index].end_index
                > config->domain.grid_size - right_reserved) {
            return invalid(error, error_size,
                "material regions must not overlap matched layers");
        }
    }
    if (config->safety.allow_unstable_courant != 0
        && config->safety.allow_unstable_courant != 1) {
        return invalid(error, error_size,
            "unstable Courant guard must be either disabled or enabled");
    }
    if (!isfinite(config->safety.maximum_field_magnitude)
        || config->safety.maximum_field_magnitude <= 0.0) {
        return invalid(error, error_size,
            "maximum field magnitude must be finite and positive");
    }
    const struct FDTD1DConfig legacy =
        legacy_config_from_experiment(config);
    const double courant = resolved_courant(&legacy);
    if (!isfinite(courant) || courant <= 0.0) {
        return invalid(error, error_size,
            "Courant number must be finite and positive");
    }
    if (courant > 1.0 && config->safety.allow_unstable_courant == 0) {
        return invalid(error, error_size,
            "Courant number above 1 requires the unstable guard");
    }
    if (courant > 1.0
        && (config->domain.grid_size > 512U
            || config->domain.time_steps > 5000U)) {
        return invalid(error, error_size,
            "unstable experiments are limited to 512 cells and 5000 steps");
    }
    struct FDTD1DConfig validation_config = legacy;
    if (courant > 1.0) {
        if (validation_config.scale == FDTD1D_SI) {
            validation_config.dt = validation_config.dx / FDTD1D_C0;
        } else {
            validation_config.courant = 1.0;
        }
    }
    return fdtd1d_validate_config(&validation_config, error, error_size);
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

static void configure_material_range(
    struct FDTD1D *simulation,
    size_t start,
    size_t end,
    const struct FDTD1DMaterialConfig *material
)
{
    const double epsilon_r = material->epsilon_r;
    const double mu_r = material->mu_r;
    double electric_loss;
    double magnetic_loss;
    double electric_curl;
    double magnetic_curl;

    if (simulation->config.scale == FDTD1D_SI) {
        const double epsilon = epsilon_r / (FDTD1D_C0 * FDTD1D_ETA0);
        const double mu = mu_r * FDTD1D_ETA0 / FDTD1D_C0;
        electric_loss = material->sigma_e * simulation->config.dt
            / (2.0 * epsilon);
        magnetic_loss = material->sigma_m * simulation->config.dt
            / (2.0 * mu);
        electric_curl = simulation->config.dt
            / (epsilon * simulation->config.dx);
        magnetic_curl = simulation->config.dt
            / (mu * simulation->config.dx);
    } else {
        electric_loss = material->sigma_e * simulation->config.dt
            / (2.0 * epsilon_r);
        magnetic_loss = material->sigma_m * simulation->config.dt
            / (2.0 * mu_r);
        electric_curl = simulation->config.courant * FDTD1D_ETA0
            / epsilon_r;
        magnetic_curl = simulation->config.courant
            / (FDTD1D_ETA0 * mu_r);
    }

    for (size_t index = start; index < end; ++index) {
        simulation->ceze[index] = (1.0 - electric_loss)
            / (1.0 + electric_loss);
        simulation->cezh[index] = electric_curl
            / (1.0 + electric_loss);
        simulation->chyh[index] = (1.0 - magnetic_loss)
            / (1.0 + magnetic_loss);
        simulation->chye[index] = magnetic_curl
            / (1.0 + magnetic_loss);
    }
}

static void configure_materials(
    struct FDTD1D *simulation,
    const struct FDTD1DMaterialRegion *materials,
    size_t material_count
)
{
    const struct FDTD1DMaterialConfig vacuum = {
        .epsilon_r = 1.0,
        .mu_r = 1.0,
        .sigma_e = 0.0,
        .sigma_m = 0.0
    };
    configure_material_range(
        simulation, 0U, simulation->config.grid_size, &vacuum
    );
    for (size_t index = 0U; index < material_count; ++index) {
        configure_material_range(
            simulation,
            materials[index].start_index,
            materials[index].end_index,
            &materials[index].material
        );
    }
}

static double matched_layer_maximum_rate(
    const struct FDTD1D *simulation,
    const struct FDTD1DMatchedLayerConfig *layer
)
{
    const double cells_per_time = simulation->config.scale == FDTD1D_SI
        ? FDTD1D_C0 / simulation->config.dx
        : 1.0;
    return -((double)layer->grading_order + 1.0)
        * cells_per_time * log(layer->target_reflection)
        / (2.0 * (double)layer->thickness);
}

static void configure_matched_coefficients(
    struct FDTD1D *simulation,
    size_t index,
    double electric_depth,
    double magnetic_depth,
    const struct FDTD1DMatchedLayerConfig *layer
)
{
    const double maximum_rate =
        matched_layer_maximum_rate(simulation, layer);
    const double electric_rate = maximum_rate
        * pow(electric_depth, (double)layer->grading_order);
    const double magnetic_rate = maximum_rate
        * pow(magnetic_depth, (double)layer->grading_order);
    const double electric_loss = electric_rate * simulation->config.dt / 2.0;
    const double magnetic_loss = magnetic_rate * simulation->config.dt / 2.0;
    const double electric_curl = simulation->config.courant * FDTD1D_ETA0;
    const double magnetic_curl = simulation->config.courant / FDTD1D_ETA0;

    simulation->ceze[index] = (1.0 - electric_loss)
        / (1.0 + electric_loss);
    simulation->cezh[index] = electric_curl / (1.0 + electric_loss);
    simulation->chyh[index] = (1.0 - magnetic_loss)
        / (1.0 + magnetic_loss);
    simulation->chye[index] = magnetic_curl / (1.0 + magnetic_loss);
}

static void configure_left_matched_layer(struct FDTD1D *simulation)
{
    const struct FDTD1DMatchedLayerConfig *layer =
        &simulation->left_matched_layer;
    for (size_t index = 0U; index < layer->thickness; ++index) {
        const double electric_depth =
            ((double)(layer->thickness - index) - 0.5)
            / (double)layer->thickness;
        const double magnetic_depth =
            (double)(layer->thickness - index - 1U)
            / (double)layer->thickness;
        configure_matched_coefficients(
            simulation, index, electric_depth, magnetic_depth, layer
        );
    }
}

static void configure_right_matched_layer(struct FDTD1D *simulation)
{
    const struct FDTD1DMatchedLayerConfig *layer =
        &simulation->right_matched_layer;
    const size_t start = simulation->config.grid_size - layer->thickness;
    for (size_t index = start; index < simulation->config.grid_size; ++index) {
        const double electric_depth =
            ((double)(index - start) + 0.5) / (double)layer->thickness;
        double magnetic_depth =
            ((double)(index - start) + 1.0) / (double)layer->thickness;
        if (magnetic_depth > 1.0) {
            magnetic_depth = 1.0;
        }
        configure_matched_coefficients(
            simulation, index, electric_depth, magnetic_depth, layer
        );
    }
}

static void configure_matched_layers(struct FDTD1D *simulation)
{
    if (simulation->left_termination
        == FDTD1D_TERMINATION_MATCHED_LAYER) {
        configure_left_matched_layer(simulation);
    }
    if (simulation->right_termination
        == FDTD1D_TERMINATION_MATCHED_LAYER) {
        configure_right_matched_layer(simulation);
    }
}

static struct FDTD1D *create_validated_config(
    const struct FDTD1DConfig *config,
    char *error,
    size_t error_size
)
{
    struct FDTD1D *simulation = calloc(1U, sizeof(*simulation));
    if (simulation == NULL) {
        invalid(error, error_size, "cannot allocate the simulation state");
        return NULL;
    }
    simulation->config = *config;
    simulation->maximum_field_magnitude = HUGE_VAL;
    simulation->excitation_type = FDTD1D_EXCITATION_POINT;
    simulation->left_termination = config->boundary == FDTD1D_BOUNDARY_PMC
        ? FDTD1D_TERMINATION_PMC
        : FDTD1D_TERMINATION_MUR1;
    simulation->right_termination = simulation->left_termination;
    configure_resolved_scale(simulation);
    simulation->ez = calloc(config->grid_size, sizeof(*simulation->ez));
    simulation->hy = calloc(config->grid_size, sizeof(*simulation->hy));
    simulation->ceze = calloc(config->grid_size, sizeof(*simulation->ceze));
    simulation->cezh = calloc(config->grid_size, sizeof(*simulation->cezh));
    simulation->chyh = calloc(config->grid_size, sizeof(*simulation->chyh));
    simulation->chye = calloc(config->grid_size, sizeof(*simulation->chye));
    if (simulation->ez == NULL || simulation->hy == NULL
        || simulation->ceze == NULL || simulation->cezh == NULL
        || simulation->chyh == NULL || simulation->chye == NULL) {
        fdtd1d_destroy(simulation);
        invalid(error, error_size, "cannot allocate the field arrays");
        return NULL;
    }
    configure_materials(simulation, NULL, 0U);
    return simulation;
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
    return create_validated_config(config, error, error_size);
}

struct FDTD1D *fdtd1d_create_experiment(
    const struct FDTD1DExperimentConfig *config,
    char *error,
    size_t error_size
)
{
    if (fdtd1d_validate_experiment(config, error, error_size) != FDTD1D_OK) {
        return NULL;
    }
    const struct FDTD1DConfig legacy =
        legacy_config_from_experiment(config);
    struct FDTD1D *simulation =
        create_validated_config(&legacy, error, error_size);
    if (simulation != NULL) {
        simulation->excitation_type = config->excitation.type;
        if (config->excitation.type == FDTD1D_EXCITATION_TFSF) {
            simulation->tfsf = config->excitation.tfsf;
        }
        simulation->left_termination = config->left_termination.type;
        simulation->right_termination = config->right_termination.type;
        simulation->left_matched_layer =
            config->left_termination.matched_layer;
        simulation->right_matched_layer =
            config->right_termination.matched_layer;
        simulation->maximum_field_magnitude =
            config->safety.maximum_field_magnitude;
        configure_materials(
            simulation, config->materials, config->material_count
        );
        configure_matched_layers(simulation);
    }
    return simulation;
}

void fdtd1d_destroy(struct FDTD1D *simulation)
{
    if (simulation != NULL) {
        free(simulation->ez);
        free(simulation->hy);
        free(simulation->ceze);
        free(simulation->cezh);
        free(simulation->chyh);
        free(simulation->chye);
        free(simulation);
    }
}

static double gaussian_value(
    const struct FDTD1DGaussianConfig *gaussian,
    double time_step
)
{
    const double offset = (time_step - gaussian->delay_steps)
        / gaussian->width_steps;
    return gaussian->amplitude * exp(-(offset * offset));
}

static double gaussian_source(const struct FDTD1D *simulation)
{
    const struct FDTD1DGaussianConfig gaussian = {
        .delay_steps = simulation->config.source.delay_steps,
        .width_steps = simulation->config.source.width_steps,
        .amplitude = simulation->config.source.amplitude
    };
    return gaussian_value(&gaussian, (double)simulation->completed_steps);
}

static void update_magnetic(struct FDTD1D *simulation)
{
    const size_t size = simulation->config.grid_size;
    for (size_t index = 0U; index < size - 1U; ++index) {
        simulation->hy[index] = simulation->chyh[index]
            * simulation->hy[index] + simulation->chye[index]
            * (simulation->ez[index + 1U] - simulation->ez[index]);
    }
}

static void apply_tfsf_magnetic_correction(struct FDTD1D *simulation)
{
    if (simulation->excitation_type != FDTD1D_EXCITATION_TFSF) {
        return;
    }
    const size_t seam = simulation->tfsf.seam_index;
    const double incident = gaussian_value(
        &simulation->tfsf.gaussian,
        (double)simulation->completed_steps
    );
    if (simulation->tfsf.direction == FDTD1D_PROPAGATE_RIGHT) {
        simulation->hy[seam - 1U] -=
            simulation->chye[seam - 1U] * incident;
    } else {
        simulation->hy[seam] += simulation->chye[seam] * incident;
    }
}

static void update_electric_interior(struct FDTD1D *simulation)
{
    const size_t size = simulation->config.grid_size;
    for (size_t index = 1U; index < size - 1U; ++index) {
        simulation->ez[index] = simulation->ceze[index]
            * simulation->ez[index] + simulation->cezh[index]
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

static void apply_tfsf_electric_correction(struct FDTD1D *simulation)
{
    const size_t seam = simulation->tfsf.seam_index;
    const double half_cell_travel = 0.5 / simulation->config.courant;
    const double incident = gaussian_value(
        &simulation->tfsf.gaussian,
        (double)simulation->completed_steps + 0.5 + half_cell_travel
    );
    simulation->ez[seam] += simulation->cezh[seam]
        * incident / FDTD1D_ETA0;
}

static void apply_excitation(struct FDTD1D *simulation)
{
    if (simulation->excitation_type == FDTD1D_EXCITATION_POINT) {
        apply_source(simulation);
    } else {
        apply_tfsf_electric_correction(simulation);
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

static double first_order_abc_coefficient(const struct FDTD1D *simulation)
{
    return (simulation->config.courant - 1.0)
        / (simulation->config.courant + 1.0);
}

static void apply_left_first_order_abc(
    struct FDTD1D *simulation,
    const struct FDTD1DBoundaryHistory *history
)
{
    const double coefficient = first_order_abc_coefficient(simulation);
    simulation->ez[0] = history->left_neighbor
        + coefficient * (simulation->ez[1] - history->left);
}

static void apply_right_first_order_abc(
    struct FDTD1D *simulation,
    const struct FDTD1DBoundaryHistory *history
)
{
    const size_t last = simulation->config.grid_size - 1U;
    const double coefficient = first_order_abc_coefficient(simulation);
    simulation->ez[last] = history->right_neighbor
        + coefficient * (simulation->ez[last - 1U] - history->right);
}

static void apply_left_termination(
    struct FDTD1D *simulation,
    const struct FDTD1DBoundaryHistory *history
)
{
    switch (simulation->left_termination) {
    case FDTD1D_TERMINATION_PMC:
        simulation->ez[0] = simulation->ez[1];
        break;
    case FDTD1D_TERMINATION_MUR1:
        apply_left_first_order_abc(simulation, history);
        break;
    case FDTD1D_TERMINATION_MATCHED_LAYER:
        break;
    }
}

static void apply_right_termination(
    struct FDTD1D *simulation,
    const struct FDTD1DBoundaryHistory *history
)
{
    const size_t last = simulation->config.grid_size - 1U;
    switch (simulation->right_termination) {
    case FDTD1D_TERMINATION_PMC:
        simulation->ez[last] = simulation->ez[last - 1U];
        break;
    case FDTD1D_TERMINATION_MUR1:
        apply_right_first_order_abc(simulation, history);
        break;
    case FDTD1D_TERMINATION_MATCHED_LAYER:
        break;
    }
}

static void apply_boundary(
    struct FDTD1D *simulation,
    const struct FDTD1DBoundaryHistory *history
)
{
    apply_left_termination(simulation, history);
    apply_right_termination(simulation, history);
}

static int fields_are_finite(const struct FDTD1D *simulation)
{
    for (size_t index = 0U; index < simulation->config.grid_size; ++index) {
        if (!isfinite(simulation->ez[index])
            || !isfinite(simulation->hy[index])
            || fabs(simulation->ez[index])
                > simulation->maximum_field_magnitude
            || fabs(simulation->hy[index]) * FDTD1D_ETA0
                > simulation->maximum_field_magnitude) {
            return 0;
        }
    }
    return 1;
}

enum FDTD1DStatus fdtd1d_advance_phase(struct FDTD1D *simulation)
{
    if (simulation == NULL) {
        return FDTD1D_INVALID_ARGUMENT;
    }
    switch (simulation->phase) {
    case FDTD1D_PHASE_MAGNETIC:
        if (simulation->completed_steps >= simulation->config.time_steps) {
            return FDTD1D_FINISHED;
        }
        simulation->boundary_history = capture_boundary_history(simulation);
        update_magnetic(simulation);
        apply_tfsf_magnetic_correction(simulation);
        simulation->phase = FDTD1D_PHASE_ELECTRIC;
        break;
    case FDTD1D_PHASE_ELECTRIC:
        update_electric_interior(simulation);
        simulation->phase = FDTD1D_PHASE_EXCITATION;
        break;
    case FDTD1D_PHASE_EXCITATION:
        apply_excitation(simulation);
        simulation->phase = FDTD1D_PHASE_TERMINATION;
        break;
    case FDTD1D_PHASE_TERMINATION:
        apply_boundary(simulation, &simulation->boundary_history);
        if (!fields_are_finite(simulation)) {
            return FDTD1D_NUMERIC_ERROR;
        }
        ++simulation->completed_steps;
        simulation->phase = FDTD1D_PHASE_MAGNETIC;
        break;
    }
    return FDTD1D_OK;
}

enum FDTD1DStatus fdtd1d_step(struct FDTD1D *simulation)
{
    if (simulation == NULL) {
        return FDTD1D_INVALID_ARGUMENT;
    }
    const size_t target_step = simulation->completed_steps + 1U;
    enum FDTD1DStatus status;
    do {
        status = fdtd1d_advance_phase(simulation);
    } while (status == FDTD1D_OK
        && simulation->completed_steps < target_step);
    return status;
}

enum FDTD1DPhase fdtd1d_phase(const struct FDTD1D *simulation)
{
    return simulation == NULL
        ? FDTD1D_PHASE_MAGNETIC
        : simulation->phase;
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
