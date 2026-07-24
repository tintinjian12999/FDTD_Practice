#include <math.h>
#include <stdio.h>

int main(void)
{
    const double pi = acos(-1.0);
    const double actual = sin(pi / 2.0);
    const double error = fabs(actual - 1.0);

    if (error > 1.0e-12) {
        fprintf(stderr, "Math smoke failed: error=%.17g\n", error);
        return 1;
    }

    printf("Math smoke passed: error=%.17g\n", error);
    return 0;
}
