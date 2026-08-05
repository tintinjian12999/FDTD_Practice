#include "ufdtd/fdtd1d.h"

#include <math.h>
#include <stdio.h>

#define CHECK(condition)                                                      \
    do {                                                                      \
        if (!(condition)) {                                                   \
            fprintf(stderr, "Check failed at %s:%d: %s\n",                  \
                    __FILE__, __LINE__, #condition);                          \
            return 1;                                                         \
        }                                                                     \
    } while (0)

static int fields_match(
    const struct FDTD1D *left,
    const struct FDTD1D *right,
    size_t grid_size
)
{
    for (size_t index = 0U; index < grid_size; ++index) {
        if (fabs(fdtd1d_electric(left)[index]
                - fdtd1d_electric(right)[index]) > 1.0e-15
            || fabs(fdtd1d_magnetic(left)[index]
                - fdtd1d_magnetic(right)[index]) > 1.0e-15) {
            return 0;
        }
    }
    return 1;
}

static int test_vacuum_material_matches_default(void)
{
    char error[256];
    struct FDTD1DExperimentConfig baseline =
        fdtd1d_default_experiment_normalized();
    baseline.domain.time_steps = 100U;
    const struct FDTD1DMaterialRegion vacuum = {
        .start_index = 0U,
        .end_index = baseline.domain.grid_size,
        .material = {
            .epsilon_r = 1.0,
            .mu_r = 1.0,
            .sigma_e = 0.0,
            .sigma_m = 0.0
        }
    };
    struct FDTD1DExperimentConfig explicit_vacuum = baseline;
    explicit_vacuum.materials = &vacuum;
    explicit_vacuum.material_count = 1U;

    struct FDTD1D *left =
        fdtd1d_create_experiment(&baseline, error, sizeof(error));
    struct FDTD1D *right =
        fdtd1d_create_experiment(&explicit_vacuum, error, sizeof(error));
    CHECK(left != NULL && right != NULL);
    for (size_t step = 0U; step < baseline.domain.time_steps; ++step) {
        CHECK(fdtd1d_step(left) == FDTD1D_OK);
        CHECK(fdtd1d_step(right) == FDTD1D_OK);
    }
    CHECK(fields_match(left, right, baseline.domain.grid_size));
    fdtd1d_destroy(left);
    fdtd1d_destroy(right);
    return 0;
}

static int test_asymmetric_terminations_are_independent(void)
{
    char error[256];
    struct FDTD1DExperimentConfig config =
        fdtd1d_default_experiment_normalized();
    config.domain.time_steps = 100U;
    config.left_termination.type = FDTD1D_TERMINATION_PMC;
    config.right_termination.type = FDTD1D_TERMINATION_MUR1;
    struct FDTD1D *simulation =
        fdtd1d_create_experiment(&config, error, sizeof(error));
    CHECK(simulation != NULL);
    while (fdtd1d_step(simulation) == FDTD1D_OK) {
        const double *electric = fdtd1d_electric(simulation);
        CHECK(electric[0] == electric[1]);
    }
    fdtd1d_destroy(simulation);
    return 0;
}

static int test_right_going_tfsf_has_low_scattered_field_leakage(void)
{
    char error[256];
    struct FDTD1DExperimentConfig config =
        fdtd1d_default_experiment_normalized();
    config.domain.grid_size = 160U;
    config.domain.time_steps = 90U;
    config.observation.probe_index = 100U;
    config.excitation.type = FDTD1D_EXCITATION_TFSF;
    config.excitation.tfsf.direction = FDTD1D_PROPAGATE_RIGHT;
    config.excitation.tfsf.seam_index = 50U;
    config.excitation.tfsf.gaussian.delay_steps = 40.0;
    config.excitation.tfsf.gaussian.width_steps = 6.0;
    config.excitation.tfsf.gaussian.amplitude = 1.0;
    struct FDTD1D *simulation =
        fdtd1d_create_experiment(&config, error, sizeof(error));
    CHECK(simulation != NULL);

    double leakage = 0.0;
    double total_field_peak = 0.0;
    while (fdtd1d_step(simulation) == FDTD1D_OK) {
        const double *electric = fdtd1d_electric(simulation);
        for (size_t index = 2U;
             index + 1U < config.excitation.tfsf.seam_index;
             ++index) {
            const double magnitude = fabs(electric[index]);
            leakage = magnitude > leakage ? magnitude : leakage;
        }
        for (size_t index = config.excitation.tfsf.seam_index;
             index < config.domain.grid_size - 2U;
             ++index) {
            const double magnitude = fabs(electric[index]);
            total_field_peak = magnitude > total_field_peak
                ? magnitude
                : total_field_peak;
        }
    }
    CHECK(total_field_peak > 0.9);
    if (leakage >= 1.0e-9) {
        fprintf(stderr, "TFSF leakage: %.17g\n", leakage);
    }
    CHECK(leakage < 1.0e-9);
    fdtd1d_destroy(simulation);
    return 0;
}

static int test_left_going_tfsf_has_low_scattered_field_leakage(void)
{
    char error[256];
    struct FDTD1DExperimentConfig config =
        fdtd1d_default_experiment_normalized();
    config.domain.grid_size = 160U;
    config.domain.time_steps = 90U;
    config.observation.probe_index = 60U;
    config.excitation.type = FDTD1D_EXCITATION_TFSF;
    config.excitation.tfsf.direction = FDTD1D_PROPAGATE_LEFT;
    config.excitation.tfsf.seam_index = 110U;
    config.excitation.tfsf.gaussian.delay_steps = 40.0;
    config.excitation.tfsf.gaussian.width_steps = 6.0;
    config.excitation.tfsf.gaussian.amplitude = 1.0;
    struct FDTD1D *simulation =
        fdtd1d_create_experiment(&config, error, sizeof(error));
    CHECK(simulation != NULL);

    double leakage = 0.0;
    double total_field_peak = 0.0;
    while (fdtd1d_step(simulation) == FDTD1D_OK) {
        const double *electric = fdtd1d_electric(simulation);
        for (size_t index = 2U;
             index <= config.excitation.tfsf.seam_index;
             ++index) {
            const double magnitude = fabs(electric[index]);
            total_field_peak = magnitude > total_field_peak
                ? magnitude
                : total_field_peak;
        }
        for (size_t index = config.excitation.tfsf.seam_index + 2U;
             index < config.domain.grid_size - 2U;
             ++index) {
            const double magnitude = fabs(electric[index]);
            leakage = magnitude > leakage ? magnitude : leakage;
        }
    }
    CHECK(total_field_peak > 0.9);
    if (leakage >= 1.0e-9) {
        fprintf(stderr, "Left-going TFSF leakage: %.17g\n", leakage);
    }
    CHECK(leakage < 1.0e-9);
    fdtd1d_destroy(simulation);
    return 0;
}

static int test_dielectric_interface_matches_fresnel_reflection(void)
{
    char error[256];
    const size_t probe = 100U;
    struct FDTD1DExperimentConfig vacuum =
        fdtd1d_default_experiment_normalized();
    vacuum.domain.grid_size = 280U;
    vacuum.domain.time_steps = 230U;
    vacuum.observation.probe_index = probe;
    vacuum.excitation.type = FDTD1D_EXCITATION_TFSF;
    vacuum.excitation.tfsf.direction = FDTD1D_PROPAGATE_RIGHT;
    vacuum.excitation.tfsf.seam_index = 50U;
    vacuum.excitation.tfsf.gaussian.delay_steps = 45.0;
    vacuum.excitation.tfsf.gaussian.width_steps = 12.0;
    vacuum.excitation.tfsf.gaussian.amplitude = 1.0;

    const struct FDTD1DMaterialRegion dielectric = {
        .start_index = 150U,
        .end_index = vacuum.domain.grid_size - 3U,
        .material = {
            .epsilon_r = 4.0,
            .mu_r = 1.0,
            .sigma_e = 0.0,
            .sigma_m = 0.0
        }
    };
    struct FDTD1DExperimentConfig loaded = vacuum;
    loaded.materials = &dielectric;
    loaded.material_count = 1U;

    struct FDTD1D *reference =
        fdtd1d_create_experiment(&vacuum, error, sizeof(error));
    struct FDTD1D *simulation =
        fdtd1d_create_experiment(&loaded, error, sizeof(error));
    CHECK(reference != NULL && simulation != NULL);

    double incident_peak = 0.0;
    double reflected_peak = 0.0;
    for (size_t step = 0U; step < vacuum.domain.time_steps; ++step) {
        CHECK(fdtd1d_step(reference) == FDTD1D_OK);
        CHECK(fdtd1d_step(simulation) == FDTD1D_OK);
        const double incident = fdtd1d_electric(reference)[probe];
        if (step < 140U && fabs(incident) > incident_peak) {
            incident_peak = fabs(incident);
        }
        if (step >= 140U) {
            const double reflected = fdtd1d_electric(simulation)[probe]
                - incident;
            if (fabs(reflected) > reflected_peak) {
                reflected_peak = fabs(reflected);
            }
        }
    }
    const double measured = reflected_peak / incident_peak;
    const double expected = 1.0 / 3.0;
    if (fabs(measured - expected) >= 0.03) {
        fprintf(stderr,
            "Fresnel reflection magnitude: measured %.17g, expected %.17g\n",
            measured, expected);
    }
    CHECK(fabs(measured - expected) < 0.03);
    fdtd1d_destroy(reference);
    fdtd1d_destroy(simulation);
    return 0;
}

static int test_matched_layer_configuration_is_accepted(void)
{
    char error[256];
    struct FDTD1DExperimentConfig config =
        fdtd1d_default_experiment_normalized();
    config.right_termination.type = FDTD1D_TERMINATION_MATCHED_LAYER;
    config.right_termination.matched_layer.thickness = 24U;
    config.right_termination.matched_layer.grading_order = 3U;
    config.right_termination.matched_layer.target_reflection = 1.0e-6;
    CHECK(fdtd1d_validate_experiment(&config, error, sizeof(error))
        == FDTD1D_OK);
    struct FDTD1D *simulation =
        fdtd1d_create_experiment(&config, error, sizeof(error));
    CHECK(simulation != NULL);
    fdtd1d_destroy(simulation);
    return 0;
}

static double measure_right_termination_reflection(
    enum FDTD1DTerminationType termination
)
{
    char error[256];
    const size_t probe = 100U;
    struct FDTD1DExperimentConfig config =
        fdtd1d_default_experiment_normalized();
    config.domain.grid_size = 300U;
    config.domain.time_steps = 560U;
    config.domain.courant = 1.0;
    config.observation.probe_index = probe;
    config.excitation.type = FDTD1D_EXCITATION_TFSF;
    config.excitation.tfsf.direction = FDTD1D_PROPAGATE_RIGHT;
    config.excitation.tfsf.seam_index = 50U;
    config.excitation.tfsf.gaussian.delay_steps = 50.0;
    config.excitation.tfsf.gaussian.width_steps = 14.0;
    config.excitation.tfsf.gaussian.amplitude = 1.0;
    config.right_termination.type = termination;
    if (termination == FDTD1D_TERMINATION_MATCHED_LAYER) {
        config.right_termination.matched_layer.thickness = 40U;
        config.right_termination.matched_layer.grading_order = 3U;
        config.right_termination.matched_layer.target_reflection = 1.0e-6;
    }
    struct FDTD1D *simulation =
        fdtd1d_create_experiment(&config, error, sizeof(error));
    if (simulation == NULL) {
        return NAN;
    }
    double incident_peak = 0.0;
    double reflected_peak = 0.0;
    for (size_t step = 0U; step < config.domain.time_steps; ++step) {
        if (fdtd1d_step(simulation) != FDTD1D_OK) {
            fdtd1d_destroy(simulation);
            return NAN;
        }
        const double magnitude = fabs(fdtd1d_electric(simulation)[probe]);
        if (step < 180U && magnitude > incident_peak) {
            incident_peak = magnitude;
        }
        if (step >= 360U && magnitude > reflected_peak) {
            reflected_peak = magnitude;
        }
    }
    fdtd1d_destroy(simulation);
    return reflected_peak / incident_peak;
}

static int test_matched_layer_reduces_outer_wall_reflection(void)
{
    const double pmc =
        measure_right_termination_reflection(FDTD1D_TERMINATION_PMC);
    const double mur =
        measure_right_termination_reflection(FDTD1D_TERMINATION_MUR1);
    const double matched = measure_right_termination_reflection(
        FDTD1D_TERMINATION_MATCHED_LAYER
    );
    CHECK(isfinite(pmc) && isfinite(mur) && isfinite(matched));
    if (matched >= 0.01 || matched >= 0.02 * pmc) {
        fprintf(stderr,
            "Termination reflection: PMC %.17g, Mur1 %.17g, matched %.17g\n",
            pmc, mur, matched);
    }
    CHECK(pmc > 0.9);
    CHECK(matched < 0.01);
    CHECK(matched < 0.02 * pmc);
    return 0;
}

static int test_unstable_courant_requires_guard_and_stops_at_limit(void)
{
    char error[256];
    struct FDTD1DExperimentConfig config =
        fdtd1d_default_experiment_normalized();
    config.domain.grid_size = 120U;
    config.domain.time_steps = 500U;
    config.domain.courant = 1.1;
    config.observation.probe_index = 80U;
    config.safety.maximum_field_magnitude = 10.0;
    CHECK(fdtd1d_validate_experiment(&config, error, sizeof(error))
        == FDTD1D_INVALID_ARGUMENT);

    config.safety.allow_unstable_courant = 1;
    CHECK(fdtd1d_validate_experiment(&config, error, sizeof(error))
        == FDTD1D_OK);
    struct FDTD1D *simulation =
        fdtd1d_create_experiment(&config, error, sizeof(error));
    CHECK(simulation != NULL);
    enum FDTD1DStatus status = FDTD1D_OK;
    while (status == FDTD1D_OK) {
        status = fdtd1d_step(simulation);
    }
    CHECK(status == FDTD1D_NUMERIC_ERROR);
    CHECK(fdtd1d_current_step(simulation) < config.domain.time_steps - 1U);
    fdtd1d_destroy(simulation);
    return 0;
}

static int test_matched_lossy_medium_matches_analytic_attenuation(void)
{
    char error[256];
    const size_t material_start = 120U;
    const size_t probe = 200U;
    const double loss_rate = 0.005;
    struct FDTD1DExperimentConfig vacuum =
        fdtd1d_default_experiment_normalized();
    vacuum.domain.grid_size = 320U;
    vacuum.domain.time_steps = 300U;
    vacuum.observation.probe_index = probe;
    vacuum.excitation.type = FDTD1D_EXCITATION_TFSF;
    vacuum.excitation.tfsf.direction = FDTD1D_PROPAGATE_RIGHT;
    vacuum.excitation.tfsf.seam_index = 50U;
    vacuum.excitation.tfsf.gaussian.delay_steps = 45.0;
    vacuum.excitation.tfsf.gaussian.width_steps = 16.0;
    vacuum.excitation.tfsf.gaussian.amplitude = 1.0;

    const struct FDTD1DMaterialRegion lossy = {
        .start_index = material_start,
        .end_index = vacuum.domain.grid_size - 3U,
        .material = {
            .epsilon_r = 1.0,
            .mu_r = 1.0,
            .sigma_e = loss_rate,
            .sigma_m = loss_rate
        }
    };
    struct FDTD1DExperimentConfig loaded = vacuum;
    loaded.materials = &lossy;
    loaded.material_count = 1U;
    struct FDTD1D *reference =
        fdtd1d_create_experiment(&vacuum, error, sizeof(error));
    struct FDTD1D *simulation =
        fdtd1d_create_experiment(&loaded, error, sizeof(error));
    CHECK(reference != NULL && simulation != NULL);

    double reference_peak = 0.0;
    double attenuated_peak = 0.0;
    for (size_t step = 0U; step < vacuum.domain.time_steps; ++step) {
        CHECK(fdtd1d_step(reference) == FDTD1D_OK);
        CHECK(fdtd1d_step(simulation) == FDTD1D_OK);
        const double reference_magnitude =
            fabs(fdtd1d_electric(reference)[probe]);
        const double attenuated_magnitude =
            fabs(fdtd1d_electric(simulation)[probe]);
        reference_peak = reference_magnitude > reference_peak
            ? reference_magnitude
            : reference_peak;
        attenuated_peak = attenuated_magnitude > attenuated_peak
            ? attenuated_magnitude
            : attenuated_peak;
    }
    const double measured = attenuated_peak / reference_peak;
    const double expected = exp(
        -loss_rate * (double)(probe - material_start)
    );
    if (fabs(measured - expected) >= 0.025) {
        fprintf(stderr,
            "Lossy attenuation: measured %.17g, expected %.17g\n",
            measured, expected);
    }
    CHECK(fabs(measured - expected) < 0.025);
    fdtd1d_destroy(reference);
    fdtd1d_destroy(simulation);
    return 0;
}

static int test_tfsf_and_mur_reject_nonvacuum_reference_cells(void)
{
    char error[256];
    struct FDTD1DExperimentConfig config =
        fdtd1d_default_experiment_normalized();
    config.excitation.type = FDTD1D_EXCITATION_TFSF;
    config.excitation.tfsf.direction = FDTD1D_PROPAGATE_RIGHT;
    config.excitation.tfsf.seam_index = 50U;
    config.excitation.tfsf.gaussian.delay_steps = 40.0;
    config.excitation.tfsf.gaussian.width_steps = 10.0;
    config.excitation.tfsf.gaussian.amplitude = 1.0;
    struct FDTD1DMaterialRegion material = {
        .start_index = 49U,
        .end_index = 80U,
        .material = {4.0, 1.0, 0.0, 0.0}
    };
    config.materials = &material;
    config.material_count = 1U;
    CHECK(fdtd1d_validate_experiment(&config, error, sizeof(error))
        == FDTD1D_INVALID_ARGUMENT);

    material.start_index = 100U;
    material.end_index = config.domain.grid_size;
    CHECK(fdtd1d_validate_experiment(&config, error, sizeof(error))
        == FDTD1D_INVALID_ARGUMENT);

    config.materials = NULL;
    config.material_count = 0U;
    config.domain.courant = 0.9;
    CHECK(fdtd1d_validate_experiment(&config, error, sizeof(error))
        == FDTD1D_INVALID_ARGUMENT);
    return 0;
}

int main(void)
{
    char error[256];
    struct FDTD1DExperimentConfig config =
        fdtd1d_default_experiment_normalized();

    CHECK(config.domain.scale == FDTD1D_NORMALIZED);
    CHECK(config.domain.grid_size == 200U);
    CHECK(config.domain.time_steps == 450U);
    CHECK(config.excitation.type == FDTD1D_EXCITATION_POINT);
    CHECK(config.excitation.point.injection == FDTD1D_SOURCE_ADDITIVE);
    CHECK(config.excitation.point.index == 50U);
    CHECK(config.left_termination.type == FDTD1D_TERMINATION_MUR1);
    CHECK(config.right_termination.type == FDTD1D_TERMINATION_MUR1);
    CHECK(config.materials == NULL);
    CHECK(config.material_count == 0U);
    CHECK(fdtd1d_validate_experiment(&config, error, sizeof(error))
        == FDTD1D_OK);

    struct FDTD1D *phased =
        fdtd1d_create_experiment(&config, error, sizeof(error));
    struct FDTD1D *complete =
        fdtd1d_create_experiment(&config, error, sizeof(error));
    CHECK(phased != NULL && complete != NULL);
    CHECK(fdtd1d_phase(phased) == FDTD1D_PHASE_MAGNETIC);
    CHECK(fdtd1d_advance_phase(phased) == FDTD1D_OK);
    CHECK(fdtd1d_phase(phased) == FDTD1D_PHASE_ELECTRIC);
    CHECK(fdtd1d_advance_phase(phased) == FDTD1D_OK);
    CHECK(fdtd1d_phase(phased) == FDTD1D_PHASE_EXCITATION);
    CHECK(fdtd1d_advance_phase(phased) == FDTD1D_OK);
    CHECK(fdtd1d_phase(phased) == FDTD1D_PHASE_TERMINATION);
    CHECK(fdtd1d_advance_phase(phased) == FDTD1D_OK);
    CHECK(fdtd1d_phase(phased) == FDTD1D_PHASE_MAGNETIC);
    CHECK(fdtd1d_step(complete) == FDTD1D_OK);
    for (size_t index = 0U; index < config.domain.grid_size; ++index) {
        CHECK(fabs(fdtd1d_electric(phased)[index]
            - fdtd1d_electric(complete)[index]) <= 1.0e-15);
        CHECK(fabs(fdtd1d_magnetic(phased)[index]
            - fdtd1d_magnetic(complete)[index]) <= 1.0e-15);
    }
    fdtd1d_destroy(phased);
    fdtd1d_destroy(complete);
    CHECK(test_vacuum_material_matches_default() == 0);
    CHECK(test_asymmetric_terminations_are_independent() == 0);
    CHECK(test_right_going_tfsf_has_low_scattered_field_leakage() == 0);
    CHECK(test_left_going_tfsf_has_low_scattered_field_leakage() == 0);
    CHECK(test_dielectric_interface_matches_fresnel_reflection() == 0);
    CHECK(test_matched_layer_configuration_is_accepted() == 0);
    CHECK(test_matched_layer_reduces_outer_wall_reflection() == 0);
    CHECK(test_unstable_courant_requires_guard_and_stops_at_limit() == 0);
    CHECK(test_matched_lossy_medium_matches_analytic_attenuation() == 0);
    CHECK(test_tfsf_and_mur_reject_nonvacuum_reference_cells() == 0);
    return 0;
}
