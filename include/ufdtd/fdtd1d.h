#ifndef UFDTD_FDTD1D_H
#define UFDTD_FDTD1D_H

#include <stddef.h>

#define FDTD1D_C0 299792458.0
#define FDTD1D_ETA0 376.730313668

enum FDTD1DMode {
    FDTD1D_HARD_PMC,
    FDTD1D_ADDITIVE_ABC
};

enum FDTD1DScale {
    FDTD1D_NORMALIZED,
    FDTD1D_SI
};

enum FDTD1DStatus {
    FDTD1D_OK,
    FDTD1D_INVALID_ARGUMENT,
    FDTD1D_ALLOCATION_FAILED,
    FDTD1D_NUMERIC_ERROR,
    FDTD1D_FINISHED
};

struct FDTD1DConfig {
    enum FDTD1DMode mode;
    enum FDTD1DScale scale;
    size_t grid_size;
    size_t time_steps;
    size_t source_index;
    size_t probe_index;
    size_t snapshot_interval;
    double courant;
    double dx;
    double dt;
    double source_delay;
    double source_width;
    double source_amplitude;
};

struct FDTD1D;

struct FDTD1DConfig fdtd1d_default_normalized(void);
struct FDTD1DConfig fdtd1d_default_si(double dx, double dt);
enum FDTD1DStatus fdtd1d_validate_config(
    const struct FDTD1DConfig *config,
    char *error,
    size_t error_size
);
struct FDTD1D *fdtd1d_create(
    const struct FDTD1DConfig *config,
    char *error,
    size_t error_size
);
void fdtd1d_destroy(struct FDTD1D *simulation);
enum FDTD1DStatus fdtd1d_step(struct FDTD1D *simulation);
const double *fdtd1d_electric(const struct FDTD1D *simulation);
const double *fdtd1d_magnetic(const struct FDTD1D *simulation);
size_t fdtd1d_current_step(const struct FDTD1D *simulation);
double fdtd1d_time(const struct FDTD1D *simulation);
double fdtd1d_position(const struct FDTD1D *simulation, size_t index);
double fdtd1d_courant(const struct FDTD1D *simulation);
const struct FDTD1DConfig *fdtd1d_config(
    const struct FDTD1D *simulation
);

#endif
