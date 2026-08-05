#ifndef UFDTD_FDTD1D_H
#define UFDTD_FDTD1D_H

#include <stddef.h>

#define FDTD1D_C0 299792458.0
#define FDTD1D_ETA0 376.730313668

enum FDTD1DSourceInjection {
    FDTD1D_SOURCE_HARD,
    FDTD1D_SOURCE_ADDITIVE
};

enum FDTD1DBoundaryType {
    FDTD1D_BOUNDARY_PMC,
    FDTD1D_BOUNDARY_MUR1
};

enum FDTD1DExcitationType {
    FDTD1D_EXCITATION_POINT,
    FDTD1D_EXCITATION_TFSF
};

enum FDTD1DPropagationDirection {
    FDTD1D_PROPAGATE_RIGHT,
    FDTD1D_PROPAGATE_LEFT
};

enum FDTD1DTerminationType {
    FDTD1D_TERMINATION_PMC,
    FDTD1D_TERMINATION_MUR1,
    FDTD1D_TERMINATION_MATCHED_LAYER
};

enum FDTD1DPhase {
    FDTD1D_PHASE_MAGNETIC,
    FDTD1D_PHASE_ELECTRIC,
    FDTD1D_PHASE_EXCITATION,
    FDTD1D_PHASE_TERMINATION
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

struct FDTD1DSourceConfig {
    enum FDTD1DSourceInjection injection;
    size_t index;
    double delay_steps;
    double width_steps;
    double amplitude;
};

struct FDTD1DGaussianConfig {
    double delay_steps;
    double width_steps;
    double amplitude;
};

struct FDTD1DPointExcitationConfig {
    enum FDTD1DSourceInjection injection;
    size_t index;
    struct FDTD1DGaussianConfig gaussian;
};

struct FDTD1DTFSFExcitationConfig {
    enum FDTD1DPropagationDirection direction;
    size_t seam_index;
    struct FDTD1DGaussianConfig gaussian;
};

struct FDTD1DExcitationConfig {
    enum FDTD1DExcitationType type;
    union {
        struct FDTD1DPointExcitationConfig point;
        struct FDTD1DTFSFExcitationConfig tfsf;
    };
};

struct FDTD1DDomainConfig {
    enum FDTD1DScale scale;
    size_t grid_size;
    size_t time_steps;
    double courant;
    double dx;
    double dt;
};

struct FDTD1DMaterialConfig {
    double epsilon_r;
    double mu_r;
    double sigma_e;
    double sigma_m;
};

struct FDTD1DMaterialRegion {
    size_t start_index;
    size_t end_index;
    struct FDTD1DMaterialConfig material;
};

struct FDTD1DMatchedLayerConfig {
    size_t thickness;
    unsigned grading_order;
    double target_reflection;
};

struct FDTD1DTerminationConfig {
    enum FDTD1DTerminationType type;
    struct FDTD1DMatchedLayerConfig matched_layer;
};

struct FDTD1DObservationConfig {
    size_t probe_index;
    size_t snapshot_interval;
};

struct FDTD1DSafetyConfig {
    int allow_unstable_courant;
    double maximum_field_magnitude;
};

struct FDTD1DExperimentConfig {
    struct FDTD1DDomainConfig domain;
    struct FDTD1DExcitationConfig excitation;
    const struct FDTD1DMaterialRegion *materials;
    size_t material_count;
    struct FDTD1DTerminationConfig left_termination;
    struct FDTD1DTerminationConfig right_termination;
    struct FDTD1DObservationConfig observation;
    struct FDTD1DSafetyConfig safety;
};

struct FDTD1DConfig {
    enum FDTD1DScale scale;
    enum FDTD1DBoundaryType boundary;
    struct FDTD1DSourceConfig source;
    size_t grid_size;
    size_t time_steps;
    size_t probe_index;
    size_t snapshot_interval;
    double courant;
    double dx;
    double dt;
};

struct FDTD1D;

struct FDTD1DConfig fdtd1d_default_normalized(void);
struct FDTD1DConfig fdtd1d_default_si(double dx, double dt);
struct FDTD1DExperimentConfig fdtd1d_default_experiment_normalized(void);
enum FDTD1DStatus fdtd1d_validate_experiment(
    const struct FDTD1DExperimentConfig *config,
    char *error,
    size_t error_size
);
struct FDTD1D *fdtd1d_create_experiment(
    const struct FDTD1DExperimentConfig *config,
    char *error,
    size_t error_size
);
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
enum FDTD1DStatus fdtd1d_advance_phase(struct FDTD1D *simulation);
enum FDTD1DPhase fdtd1d_phase(const struct FDTD1D *simulation);
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
