#include "ufdtd/fdtd1d.h"

#include <math.h>
#include <stdio.h>
#include <string.h>

#define CHECK(condition)                                                      \
    do {                                                                      \
        if (!(condition)) {                                                   \
            fprintf(stderr, "Check failed at %s:%d: %s\n",                  \
                    __FILE__, __LINE__, #condition);                          \
            return 1;                                                         \
        }                                                                     \
    } while (0)

static int validate_fails(struct FDTD1DConfig config)
{
    char error[256];
    return fdtd1d_validate_config(&config, error, sizeof(error))
        == FDTD1D_INVALID_ARGUMENT;
}

static int test_default_configurations(void)
{
    char error[256];
    struct FDTD1DConfig normalized = fdtd1d_default_normalized();
    CHECK(fdtd1d_validate_config(&normalized, error, sizeof(error)) == FDTD1D_OK);
    CHECK(normalized.mode == FDTD1D_ADDITIVE_ABC);
    CHECK(normalized.scale == FDTD1D_NORMALIZED);
    CHECK(normalized.grid_size == 200U);
    CHECK(normalized.time_steps == 450U);

    const double dx = 0.01;
    const double dt = 0.9 * dx / FDTD1D_C0;
    struct FDTD1DConfig si = fdtd1d_default_si(dx, dt);
    CHECK(fdtd1d_validate_config(&si, error, sizeof(error)) == FDTD1D_OK);
    CHECK(fabs(si.courant - 0.9) <= 1.0e-12);
    return 0;
}

static int test_invalid_configurations(void)
{
    struct FDTD1DConfig config = fdtd1d_default_normalized();
    config.grid_size = 4U;
    CHECK(validate_fails(config));
    config = fdtd1d_default_normalized();
    config.time_steps = 0U;
    CHECK(validate_fails(config));
    config = fdtd1d_default_normalized();
    config.snapshot_interval = 0U;
    CHECK(validate_fails(config));
    config = fdtd1d_default_normalized();
    config.probe_index = config.grid_size;
    CHECK(validate_fails(config));
    return 0;
}

static int test_invalid_sources_and_courant(void)
{
    struct FDTD1DConfig config = fdtd1d_default_normalized();
    config.source_index = 1U;
    CHECK(validate_fails(config));
    config = fdtd1d_default_normalized();
    config.source_width = 0.0;
    CHECK(validate_fails(config));
    config = fdtd1d_default_normalized();
    config.courant = 1.01;
    CHECK(validate_fails(config));
    config.courant = NAN;
    CHECK(validate_fails(config));
    config.courant = INFINITY;
    CHECK(validate_fails(config));
    return 0;
}

static int test_hard_source_constraints(void)
{
    struct FDTD1DConfig config = fdtd1d_default_normalized();
    config.mode = FDTD1D_HARD_PMC;
    config.source_index = 1U;
    CHECK(validate_fails(config));
    config.source_index = 0U;
    CHECK(!validate_fails(config));
    return 0;
}

static int test_zero_initialized_state(void)
{
    char error[256];
    struct FDTD1DConfig config = fdtd1d_default_normalized();
    struct FDTD1D *simulation =
        fdtd1d_create(&config, error, sizeof(error));
    CHECK(simulation != NULL);
    const double *electric = fdtd1d_electric(simulation);
    const double *magnetic = fdtd1d_magnetic(simulation);
    for (size_t index = 0U; index < config.grid_size; ++index) {
        CHECK(electric[index] == 0.0);
        CHECK(magnetic[index] == 0.0);
    }
    fdtd1d_destroy(simulation);
    return 0;
}

static int test_hard_source_peak(void)
{
    char error[256];
    struct FDTD1DConfig config = fdtd1d_default_normalized();
    config.mode = FDTD1D_HARD_PMC;
    config.source_index = 0U;
    config.probe_index = 50U;
    config.time_steps = 250U;
    struct FDTD1D *simulation =
        fdtd1d_create(&config, error, sizeof(error));
    CHECK(simulation != NULL);

    double maximum = -1.0;
    size_t peak_step = 0U;
    while (fdtd1d_step(simulation) == FDTD1D_OK) {
        const double sample = fdtd1d_electric(simulation)[50];
        if (sample > maximum) {
            maximum = sample;
            peak_step = fdtd1d_current_step(simulation);
        }
    }
    CHECK(peak_step == 80U);
    CHECK(fabs(maximum - 1.0) <= 1.0e-12);
    CHECK(fdtd1d_step(simulation) == FDTD1D_FINISHED);
    fdtd1d_destroy(simulation);
    return 0;
}

static int compare_fields(
    const struct FDTD1D *left,
    const struct FDTD1D *right,
    size_t grid_size
)
{
    const double *left_electric = fdtd1d_electric(left);
    const double *right_electric = fdtd1d_electric(right);
    const double *left_magnetic = fdtd1d_magnetic(left);
    const double *right_magnetic = fdtd1d_magnetic(right);
    for (size_t index = 0U; index < grid_size; ++index) {
        if (fabs(left_electric[index] - right_electric[index]) > 1.0e-12
            || fabs(left_magnetic[index] - right_magnetic[index]) > 1.0e-12) {
            return 1;
        }
    }
    return 0;
}

static int test_normalized_si_equivalence(void)
{
    char error[256];
    struct FDTD1DConfig normalized = fdtd1d_default_normalized();
    normalized.courant = 0.9;
    normalized.time_steps = 100U;
    const double dx = 0.01;
    const double dt = normalized.courant * dx / FDTD1D_C0;
    struct FDTD1DConfig si = fdtd1d_default_si(dx, dt);
    si.time_steps = normalized.time_steps;
    struct FDTD1D *left = fdtd1d_create(&normalized, error, sizeof(error));
    struct FDTD1D *right = fdtd1d_create(&si, error, sizeof(error));
    CHECK(left != NULL && right != NULL);
    for (size_t step = 0U; step < normalized.time_steps; ++step) {
        CHECK(fdtd1d_step(left) == FDTD1D_OK);
        CHECK(fdtd1d_step(right) == FDTD1D_OK);
        CHECK(compare_fields(left, right, normalized.grid_size) == 0);
    }
    fdtd1d_destroy(left);
    fdtd1d_destroy(right);
    return 0;
}

static int test_absorbing_boundary_residual(void)
{
    char error[256];
    struct FDTD1DConfig config = fdtd1d_default_normalized();
    config.grid_size = 100U;
    config.source_index = 50U;
    config.probe_index = 50U;
    config.time_steps = 400U;
    config.source_delay = 60.0;
    struct FDTD1D *simulation =
        fdtd1d_create(&config, error, sizeof(error));
    CHECK(simulation != NULL);
    while (fdtd1d_step(simulation) == FDTD1D_OK) {
    }
    double maximum = 0.0;
    for (size_t index = 0U; index < config.grid_size; ++index) {
        const double magnitude = fabs(fdtd1d_electric(simulation)[index]);
        maximum = magnitude > maximum ? magnitude : maximum;
    }
    if (maximum >= 1.0e-9) {
        fprintf(stderr, "ABC residual maximum: %.17g\n", maximum);
    }
    CHECK(maximum < 1.0e-9);
    fdtd1d_destroy(simulation);
    return 0;
}

int main(void)
{
    CHECK(test_default_configurations() == 0);
    CHECK(test_invalid_configurations() == 0);
    CHECK(test_invalid_sources_and_courant() == 0);
    CHECK(test_hard_source_constraints() == 0);
    CHECK(test_zero_initialized_state() == 0);
    CHECK(test_hard_source_peak() == 0);
    CHECK(test_normalized_si_equivalence() == 0);
    CHECK(test_absorbing_boundary_residual() == 0);
    printf("FDTD1D core tests passed.\n");
    return 0;
}
