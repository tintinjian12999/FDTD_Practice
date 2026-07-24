#include <math.h>
#include <stdio.h>

#define GRID_SIZE 200
#define TIME_STEPS 250

int main(void)
{
    double ez[GRID_SIZE] = {0.0};
    double hy[GRID_SIZE] = {0.0};
    const double impedance = 377.0;

    for (int time_step = 0; time_step < TIME_STEPS; ++time_step) {
        for (int index = 0; index < GRID_SIZE - 1; ++index) {
            hy[index] += (ez[index + 1] - ez[index]) / impedance;
        }
        for (int index = 1; index < GRID_SIZE; ++index) {
            ez[index] += (hy[index] - hy[index - 1]) * impedance;
        }

        const double offset = (double)time_step - 30.0;
        ez[0] = exp(-(offset * offset) / 100.0);
        if (printf("%.17g\n", ez[50]) < 0) {
            fprintf(stderr, "Failed to write the probe sample.\n");
            return 1;
        }
    }

    return 0;
}
