#include <mpi.h>
#include <stdio.h>

static int report_mpi_error(int error, const char *operation)
{
    char message[MPI_MAX_ERROR_STRING];
    int length = 0;
    const int string_error = MPI_Error_string(error, message, &length);
    if (string_error == MPI_SUCCESS) {
        fprintf(stderr, "%s failed: %.*s\n", operation, length, message);
    } else {
        fprintf(stderr, "%s failed with MPI error code %d.\n", operation, error);
    }
    return 1;
}

static int gather_and_validate_ranks(int rank, int size)
{
    if (size != 4) {
        if (rank == 0) {
            fprintf(
                stderr,
                "Expected 4 MPI processes. "
                "Skipping rank gather because %d processes were started.\n",
                size
            );
        }
        return 1;
    }

    int ranks[4] = {-1, -1, -1, -1};
    int error = MPI_Gather(
        &rank, 1, MPI_INT, ranks, 1, MPI_INT, 0, MPI_COMM_WORLD
    );
    if (error != MPI_SUCCESS) {
        return report_mpi_error(error, "MPI_Gather");
    }

    int status = 0;
    if (rank == 0) {
        for (int index = 0; index < 4; ++index) {
            if (ranks[index] != index) {
                fprintf(stderr, "Unexpected rank at index %d.\n", index);
                status = 1;
            }
        }
    }

    error = MPI_Bcast(&status, 1, MPI_INT, 0, MPI_COMM_WORLD);
    return error == MPI_SUCCESS
        ? status
        : report_mpi_error(error, "MPI_Bcast");
}

static int finalize_mpi(void)
{
    const int error = MPI_Finalize();
    if (error != MPI_SUCCESS) {
        fprintf(stderr, "MPI_Finalize failed with code %d.\n", error);
        return 1;
    }
    return 0;
}

int main(int argc, char **argv)
{
    int error = MPI_Init(&argc, &argv);
    if (error != MPI_SUCCESS) {
        fprintf(stderr, "MPI_Init failed with code %d.\n", error);
        return 1;
    }

    error = MPI_Comm_set_errhandler(MPI_COMM_WORLD, MPI_ERRORS_RETURN);
    if (error != MPI_SUCCESS) {
        const int status = report_mpi_error(error, "MPI_Comm_set_errhandler");
        return finalize_mpi() == 0 ? status : 1;
    }
    int rank = -1;
    int size = 0;
    int status = 0;

    error = MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    if (error != MPI_SUCCESS) {
        status = report_mpi_error(error, "MPI_Comm_rank");
    }
    error = MPI_Comm_size(MPI_COMM_WORLD, &size);
    if (error != MPI_SUCCESS) {
        status = report_mpi_error(error, "MPI_Comm_size");
    }
    if (status == 0) {
        status = gather_and_validate_ranks(rank, size);
    }

    if (finalize_mpi() != 0) {
        return 1;
    }
    if (rank == 0 && status == 0) {
        printf("MPI smoke passed with 4 processes.\n");
    }
    return status;
}
