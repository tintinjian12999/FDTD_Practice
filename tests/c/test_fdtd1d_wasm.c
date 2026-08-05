#include "ufdtd/fdtd1d.h"
#include "ufdtd/fdtd1d_wasm.h"

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

int main(void)
{
    char error[256];
    struct FDTD1DExperimentConfig config =
        fdtd1d_default_experiment_normalized();
    config.domain.grid_size = 160U;
    config.domain.time_steps = 100U;
    config.domain.courant = 0.9;
    config.observation.probe_index = 80U;
    config.excitation.point.index = 45U;
    config.excitation.point.gaussian.delay_steps = 35.0;
    config.excitation.point.gaussian.width_steps = 9.0;

    struct FDTD1D *native =
        fdtd1d_create_experiment(&config, error, sizeof(error));
    struct FDTD1DWasmSession *adapter =
        ufdtd_wasm_create_normalized(160U, 100U, 0.9);
    CHECK(native != NULL && adapter != NULL);
    CHECK(ufdtd_wasm_set_point_excitation(
        adapter, FDTD1D_SOURCE_ADDITIVE, 45U, 35.0, 9.0, 1.0
    ) == FDTD1D_OK);
    CHECK(ufdtd_wasm_start(adapter) == FDTD1D_OK);

    for (size_t step = 0U; step < config.domain.time_steps; ++step) {
        CHECK(fdtd1d_step(native) == FDTD1D_OK);
        CHECK(ufdtd_wasm_step(adapter) == FDTD1D_OK);
    }
    CHECK(ufdtd_wasm_grid_size(adapter) == config.domain.grid_size);
    CHECK(ufdtd_wasm_current_step(adapter) == fdtd1d_current_step(native));
    for (size_t index = 0U; index < config.domain.grid_size; ++index) {
        CHECK(fabs(ufdtd_wasm_electric(adapter)[index]
            - fdtd1d_electric(native)[index]) <= 1.0e-15);
        CHECK(fabs(ufdtd_wasm_magnetic(adapter)[index]
            - fdtd1d_magnetic(native)[index]) <= 1.0e-15);
    }
    fdtd1d_destroy(native);
    ufdtd_wasm_destroy(adapter);
    return 0;
}
