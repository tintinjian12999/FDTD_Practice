#include "fdtd1d_output.h"

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <windows.h>

struct FDTD1DOutput {
    FILE *probe;
    FILE *snapshots;
    struct FDTD1DConfig config;
};

static void set_error(char *error, size_t error_size, const char *message)
{
    if (error != NULL && error_size > 0U) {
        (void)snprintf(error, error_size, "%s", message);
    }
}

static int ensure_directory(const char *path)
{
    DWORD attributes;

    if (CreateDirectoryA(path, NULL) != 0) {
        return 1;
    }
    if (GetLastError() != ERROR_ALREADY_EXISTS) {
        return 0;
    }
    attributes = GetFileAttributesA(path);
    return attributes != INVALID_FILE_ATTRIBUTES
        && (attributes & FILE_ATTRIBUTE_DIRECTORY) != 0U;
}

static size_t directory_scan_start(const char *path, size_t length)
{
    const char *separator;

    if (length >= 3U && path[1] == ':' && path[2] == '\\') {
        return 3U;
    }
    if (length >= 2U && path[0] == '\\' && path[1] == '\\') {
        separator = strchr(path + 2, '\\');
        if (separator != NULL) {
            separator = strchr(separator + 1, '\\');
        }
        return separator == NULL
            ? length
            : (size_t)(separator - path) + 1U;
    }
    return length > 0U && path[0] == '\\' ? 1U : 0U;
}

static int create_directory_tree(const char *directory)
{
    char path[MAX_PATH];
    size_t index;
    size_t length = strlen(directory);

    if (length == 0U || length >= sizeof(path)) {
        return 0;
    }
    (void)memcpy(path, directory, length + 1U);
    for (index = 0U; index < length; ++index) {
        if (path[index] == '/') {
            path[index] = '\\';
        }
    }
    for (index = directory_scan_start(path, length); index < length; ++index) {
        if (path[index] != '\\') {
            continue;
        }
        path[index] = '\0';
        if (!ensure_directory(path)) {
            return 0;
        }
        path[index] = '\\';
    }
    return ensure_directory(path);
}

static int join_path(
    char *result,
    size_t result_size,
    const char *directory,
    const char *filename
)
{
    int count = snprintf(result, result_size, "%s\\%s", directory, filename);
    return count >= 0 && (size_t)count < result_size;
}

static const char *mode_name(enum FDTD1DMode mode)
{
    return mode == FDTD1D_HARD_PMC ? "hard-pmc" : "additive-abc";
}

static const char *scale_name(enum FDTD1DScale scale)
{
    return scale == FDTD1D_SI ? "si" : "normalized";
}

static int write_metadata_body(
    FILE *stream,
    const struct FDTD1DConfig *config
)
{
    return fprintf(
        stream,
        "{\n"
        "  \"schema_version\": 1,\n"
        "  \"mode\": \"%s\",\n"
        "  \"scale\": \"%s\",\n"
        "  \"grid_size\": %zu,\n"
        "  \"time_steps\": %zu,\n"
        "  \"courant\": %.17g,\n"
        "  \"dx\": %.17g,\n"
        "  \"dt\": %.17g,\n"
        "  \"source_index\": %zu,\n"
        "  \"probe_index\": %zu,\n"
        "  \"source_delay\": %.17g,\n"
        "  \"source_width\": %.17g,\n"
        "  \"source_amplitude\": %.17g,\n"
        "  \"snapshot_interval\": %zu,\n"
        "  \"time_unit\": \"%s\",\n"
        "  \"position_unit\": \"%s\"\n"
        "}\n",
        mode_name(config->mode), scale_name(config->scale),
        config->grid_size, config->time_steps, config->courant,
        config->dx, config->dt, config->source_index, config->probe_index,
        config->source_delay, config->source_width,
        config->source_amplitude, config->snapshot_interval,
        config->scale == FDTD1D_SI ? "seconds" : "normalized",
        config->scale == FDTD1D_SI ? "meters" : "cells"
    ) >= 0;
}

static int write_metadata(
    const char *directory,
    const struct FDTD1DConfig *config
)
{
    char path[MAX_PATH];
    FILE *stream;
    int success;

    if (!join_path(path, sizeof(path), directory, "run.json")) {
        return 0;
    }
    stream = fopen(path, "w");
    if (stream == NULL) {
        return 0;
    }
    success = write_metadata_body(stream, config);
    return fclose(stream) == 0 && success;
}

static FILE *open_output_file(
    const char *directory,
    const char *filename
)
{
    char path[MAX_PATH];

    if (!join_path(path, sizeof(path), directory, filename)) {
        return NULL;
    }
    return fopen(path, "w");
}

static void dispose_output(FDTD1DOutput *output)
{
    if (output == NULL) {
        return;
    }
    if (output->probe != NULL) {
        (void)fclose(output->probe);
    }
    if (output->snapshots != NULL) {
        (void)fclose(output->snapshots);
    }
    free(output);
}

FDTD1DOutput *fdtd1d_output_open(
    const char *directory,
    const struct FDTD1DConfig *config,
    char *error,
    size_t error_size
)
{
    FDTD1DOutput *output;

    if (!create_directory_tree(directory)) {
        set_error(error, error_size, "Could not create output directory.");
        return NULL;
    }
    output = (FDTD1DOutput *)calloc(1U, sizeof(*output));
    if (output == NULL) {
        set_error(error, error_size, "Could not allocate output state.");
        return NULL;
    }
    output->config = *config;
    output->probe = open_output_file(directory, "probe.csv");
    output->snapshots = open_output_file(directory, "snapshots.csv");
    if (output->probe == NULL || output->snapshots == NULL
        || !write_metadata(directory, config)) {
        dispose_output(output);
        set_error(error, error_size, "Could not open output files.");
        return NULL;
    }
    if (fprintf(output->probe, "time_step,time,ez\n") < 0
        || fprintf(
            output->snapshots,
            "time_step,time,index,position,ez\n"
        ) < 0) {
        dispose_output(output);
        set_error(error, error_size, "Could not write output headers.");
        return NULL;
    }
    return output;
}

static int write_probe(
    FDTD1DOutput *output,
    const struct FDTD1D *simulation
)
{
    const struct FDTD1DConfig *config = fdtd1d_config(simulation);
    size_t step = fdtd1d_current_step(simulation);
    double time = fdtd1d_time(simulation);
    double value = fdtd1d_electric(simulation)[config->probe_index];

    return fprintf(
        output->probe, "%zu,%.17g,%.17g\n", step, time, value
    ) >= 0;
}

static int write_snapshot(
    FDTD1DOutput *output,
    const struct FDTD1D *simulation
)
{
    const struct FDTD1DConfig *config = fdtd1d_config(simulation);
    const double *electric = fdtd1d_electric(simulation);
    size_t step = fdtd1d_current_step(simulation);
    double time = fdtd1d_time(simulation);
    size_t index;

    for (index = 0U; index < config->grid_size; ++index) {
        double position = fdtd1d_position(simulation, index);
        if (fprintf(
            output->snapshots,
            "%zu,%.17g,%zu,%.17g,%.17g\n",
            step, time, index, position, electric[index]
        ) < 0) {
            return 0;
        }
    }
    return 1;
}

int fdtd1d_output_write(
    FDTD1DOutput *output,
    const struct FDTD1D *simulation,
    char *error,
    size_t error_size
)
{
    size_t step = fdtd1d_current_step(simulation);

    if (!write_probe(output, simulation)) {
        set_error(error, error_size, "Could not write probe data.");
        return 0;
    }
    if (step % output->config.snapshot_interval == 0U
        && !write_snapshot(output, simulation)) {
        set_error(error, error_size, "Could not write snapshot data.");
        return 0;
    }
    return 1;
}

int fdtd1d_output_close(
    FDTD1DOutput *output,
    char *error,
    size_t error_size
)
{
    int success = 1;

    if (output == NULL) {
        return 1;
    }
    if (output->probe != NULL && fclose(output->probe) != 0) {
        success = 0;
    }
    if (output->snapshots != NULL && fclose(output->snapshots) != 0) {
        success = 0;
    }
    free(output);
    if (!success) {
        set_error(error, error_size, "Could not close output files.");
    }
    return success;
}
