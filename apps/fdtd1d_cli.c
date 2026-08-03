#include "fdtd1d_output.h"
#include "ufdtd/fdtd1d.h"

#include <errno.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <windows.h>

enum {
    OPT_SOURCE = 1U << 0,
    OPT_BOUNDARY = 1U << 1,
    OPT_SCALE = 1U << 2,
    OPT_GRID = 1U << 3,
    OPT_STEPS = 1U << 4,
    OPT_COURANT = 1U << 5,
    OPT_DX = 1U << 6,
    OPT_DT = 1U << 7,
    OPT_SOURCE_INDEX = 1U << 8,
    OPT_PROBE = 1U << 9,
    OPT_DELAY = 1U << 10,
    OPT_WIDTH = 1U << 11,
    OPT_AMPLITUDE = 1U << 12,
    OPT_INTERVAL = 1U << 13,
    OPT_OUTPUT = 1U << 14
};

typedef struct {
    struct FDTD1DConfig config;
    char output_directory[MAX_PATH];
    unsigned seen;
} CliOptions;

static void print_usage(FILE *stream)
{
    (void)fprintf(
        stream,
        "Usage: fdtd1d [options]\n"
        "  --source hard|additive    --boundary pmc|mur1\n"
        "  --scale normalized|si\n"
        "  --grid-size N              --time-steps N\n"
        "  --courant VALUE            --dx VALUE --dt VALUE\n"
        "  --source-index N           --probe-index N\n"
        "  --source-delay VALUE       --source-width VALUE\n"
        "  --source-amplitude VALUE   --snapshot-interval N\n"
        "  --output-dir PATH          --help\n"
    );
}

static unsigned option_bit(const char *name)
{
    static const char *names[] = {
        "--source", "--boundary", "--scale", "--grid-size", "--time-steps",
        "--courant", "--dx", "--dt", "--source-index",
        "--probe-index", "--source-delay", "--source-width",
        "--source-amplitude", "--snapshot-interval", "--output-dir"
    };
    size_t index;

    for (index = 0U; index < sizeof(names) / sizeof(names[0]); ++index) {
        if (strcmp(name, names[index]) == 0) {
            return 1U << index;
        }
    }
    return 0U;
}

static int parse_size(const char *text, size_t *value)
{
    char *end;
    unsigned long long parsed;

    if (text[0] == '\0' || text[0] == '-') {
        return 0;
    }
    errno = 0;
    parsed = strtoull(text, &end, 10);
    if (errno != 0 || *end != '\0' || parsed > SIZE_MAX) {
        return 0;
    }
    *value = (size_t)parsed;
    return 1;
}

static int parse_double_value(const char *text, double *value)
{
    char *end;
    double parsed;

    errno = 0;
    parsed = strtod(text, &end);
    if (text[0] == '\0' || errno != 0 || *end != '\0'
        || !isfinite(parsed)) {
        return 0;
    }
    *value = parsed;
    return 1;
}

static int parse_source_boundary_or_scale(
    CliOptions *options,
    const char *name,
    const char *value
)
{
    if (strcmp(name, "--source") == 0) {
        if (strcmp(value, "hard") == 0) {
            options->config.source.injection = FDTD1D_SOURCE_HARD;
        } else if (strcmp(value, "additive") == 0) {
            options->config.source.injection = FDTD1D_SOURCE_ADDITIVE;
        } else {
            return 0;
        }
        return 1;
    }
    if (strcmp(name, "--boundary") == 0) {
        if (strcmp(value, "pmc") == 0) {
            options->config.boundary = FDTD1D_BOUNDARY_PMC;
        } else if (strcmp(value, "mur1") == 0) {
            options->config.boundary = FDTD1D_BOUNDARY_MUR1;
        } else {
            return 0;
        }
        return 1;
    }
    if (strcmp(name, "--scale") != 0) {
        return -1;
    }
    if (strcmp(value, "normalized") == 0) {
        options->config.scale = FDTD1D_NORMALIZED;
    } else if (strcmp(value, "si") == 0) {
        options->config.scale = FDTD1D_SI;
    } else {
        return 0;
    }
    return 1;
}

static int parse_size_option(
    CliOptions *options,
    const char *name,
    const char *value
)
{
    size_t parsed;
    size_t *target;

    if (strcmp(name, "--grid-size") == 0) {
        target = &options->config.grid_size;
    } else if (strcmp(name, "--time-steps") == 0) {
        target = &options->config.time_steps;
    } else if (strcmp(name, "--source-index") == 0) {
        target = &options->config.source.index;
    } else if (strcmp(name, "--probe-index") == 0) {
        target = &options->config.probe_index;
    } else if (strcmp(name, "--snapshot-interval") == 0) {
        target = &options->config.snapshot_interval;
    } else {
        return -1;
    }
    if (!parse_size(value, &parsed)) {
        return 0;
    }
    *target = parsed;
    return 1;
}

static int parse_double_option(
    CliOptions *options,
    const char *name,
    const char *value
)
{
    double parsed;
    double *target;

    if (strcmp(name, "--courant") == 0) {
        target = &options->config.courant;
    } else if (strcmp(name, "--dx") == 0) {
        target = &options->config.dx;
    } else if (strcmp(name, "--dt") == 0) {
        target = &options->config.dt;
    } else if (strcmp(name, "--source-delay") == 0) {
        target = &options->config.source.delay_steps;
    } else if (strcmp(name, "--source-width") == 0) {
        target = &options->config.source.width_steps;
    } else if (strcmp(name, "--source-amplitude") == 0) {
        target = &options->config.source.amplitude;
    } else {
        return -1;
    }
    if (!parse_double_value(value, &parsed)) {
        return 0;
    }
    *target = parsed;
    return 1;
}

static int parse_output_directory(
    CliOptions *options,
    const char *name,
    const char *value
)
{
    size_t length;

    if (strcmp(name, "--output-dir") != 0) {
        return -1;
    }
    length = strlen(value);
    if (length == 0U || length >= sizeof(options->output_directory)) {
        return 0;
    }
    (void)memcpy(options->output_directory, value, length + 1U);
    return 1;
}

static int parse_option(
    CliOptions *options,
    const char *name,
    const char *value
)
{
    int result = parse_source_boundary_or_scale(options, name, value);

    if (result < 0) {
        result = parse_size_option(options, name, value);
    }
    if (result < 0) {
        result = parse_double_option(options, name, value);
    }
    if (result < 0) {
        result = parse_output_directory(options, name, value);
    }
    return result;
}

static int validate_scale_options(
    const CliOptions *options,
    char *error,
    size_t error_size
)
{
    int has_dx = (options->seen & OPT_DX) != 0U;
    int has_dt = (options->seen & OPT_DT) != 0U;
    int has_courant = (options->seen & OPT_COURANT) != 0U;

    if (options->config.scale == FDTD1D_SI) {
        if (!has_dx || !has_dt || has_courant) {
            (void)snprintf(
                error, error_size,
                "SI scale requires --dx and --dt and rejects --courant."
            );
            return 0;
        }
    } else if (has_dx || has_dt) {
        (void)snprintf(
            error, error_size,
            "Normalized scale rejects --dx and --dt."
        );
        return 0;
    }
    return 1;
}

static void initialize_options(CliOptions *options)
{
    size_t length;

    options->config = fdtd1d_default_normalized();
    options->seen = 0U;
    length = strlen("output/fdtd1d");
    (void)memcpy(options->output_directory, "output/fdtd1d", length + 1U);
}

static int parse_arguments(
    int argument_count,
    char **arguments,
    CliOptions *options,
    char *error,
    size_t error_size
)
{
    int index;

    initialize_options(options);
    for (index = 1; index < argument_count; index += 2) {
        unsigned bit = option_bit(arguments[index]);
        if (bit == 0U || index + 1 >= argument_count) {
            (void)snprintf(error, error_size, "Unknown or incomplete option.");
            return 0;
        }
        if ((options->seen & bit) != 0U) {
            (void)snprintf(error, error_size, "Duplicate option.");
            return 0;
        }
        if (parse_option(options, arguments[index], arguments[index + 1]) <= 0) {
            (void)snprintf(error, error_size, "Invalid option value.");
            return 0;
        }
        options->seen |= bit;
    }
    return validate_scale_options(options, error, error_size);
}

static int execute_steps(
    struct FDTD1D *simulation,
    FDTD1DOutput *output,
    char *error,
    size_t error_size
)
{
    enum FDTD1DStatus status;

    while ((status = fdtd1d_step(simulation)) == FDTD1D_OK) {
        if (!fdtd1d_output_write(
            output, simulation, error, error_size
        )) {
            return 0;
        }
    }
    if (status != FDTD1D_FINISHED) {
        (void)snprintf(error, error_size, "Simulation failed.");
        return 0;
    }
    return 1;
}

static int run_simulation(const CliOptions *options)
{
    char error[256] = {0};
    struct FDTD1D *simulation =
        fdtd1d_create(&options->config, error, sizeof(error));
    FDTD1DOutput *output;
    int success = 1;

    if (simulation == NULL) {
        (void)fprintf(stderr, "fdtd1d: %s\n", error);
        return 1;
    }
    output = fdtd1d_output_open(
        options->output_directory, fdtd1d_config(simulation),
        error, sizeof(error)
    );
    if (output == NULL) {
        (void)fprintf(stderr, "fdtd1d: %s\n", error);
        fdtd1d_destroy(simulation);
        return 1;
    }
    success = execute_steps(simulation, output, error, sizeof(error));
    if (!fdtd1d_output_close(output, error, sizeof(error))) {
        success = 0;
    }
    fdtd1d_destroy(simulation);
    if (!success) {
        (void)fprintf(stderr, "fdtd1d: %s\n", error);
    }
    return success ? 0 : 1;
}

int main(int argument_count, char **arguments)
{
    CliOptions options;
    char error[256] = {0};
    enum FDTD1DStatus status;

    if (argument_count == 2 && strcmp(arguments[1], "--help") == 0) {
        print_usage(stdout);
        return 0;
    }
    if (!parse_arguments(
        argument_count, arguments, &options, error, sizeof(error)
    )) {
        (void)fprintf(stderr, "fdtd1d: %s\n", error);
        print_usage(stderr);
        return 2;
    }
    status = fdtd1d_validate_config(&options.config, error, sizeof(error));
    if (status != FDTD1D_OK) {
        (void)fprintf(stderr, "fdtd1d: %s\n", error);
        return 2;
    }
    return run_simulation(&options);
}
