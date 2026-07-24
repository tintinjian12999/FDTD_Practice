#include <errno.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

int main(int argc, char **argv)
{
    if (argc != 2) {
        fprintf(stderr, "Usage: signal_writer OUTPUT_CSV\n");
        return 2;
    }

    FILE *stream = fopen(argv[1], "w");
    if (stream == NULL) {
        fprintf(stderr, "Cannot open %s: %s\n", argv[1], strerror(errno));
        return 1;
    }

    if (fprintf(stream, "index,value\n") < 0) {
        fprintf(stderr, "Cannot write CSV header.\n");
        fclose(stream);
        return 1;
    }

    const double pi = acos(-1.0);
    for (int index = 0; index < 128; ++index) {
        const double value = sin(2.0 * pi * (double)index / 128.0);
        if (fprintf(stream, "%d,%.17g\n", index, value) < 0) {
            fprintf(stderr, "Cannot write CSV row %d.\n", index);
            fclose(stream);
            return 1;
        }
    }

    if (fclose(stream) != 0) {
        fprintf(stderr, "Cannot close %s: %s\n", argv[1], strerror(errno));
        return 1;
    }

    return 0;
}
