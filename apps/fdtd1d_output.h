#ifndef UFDTD_FDTD1D_OUTPUT_H
#define UFDTD_FDTD1D_OUTPUT_H

#include "ufdtd/fdtd1d.h"

#include <stddef.h>

typedef struct FDTD1DOutput FDTD1DOutput;

FDTD1DOutput *fdtd1d_output_open(
    const char *directory,
    const struct FDTD1DConfig *config,
    char *error,
    size_t error_size
);

int fdtd1d_output_write(
    FDTD1DOutput *output,
    const struct FDTD1D *simulation,
    char *error,
    size_t error_size
);

int fdtd1d_output_close(
    FDTD1DOutput *output,
    char *error,
    size_t error_size
);

#endif
