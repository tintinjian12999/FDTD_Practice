#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

struct WorkRange {
    uint64_t first;
    uint64_t last;
    uint64_t sum;
};

static void *sum_range(void *argument)
{
    struct WorkRange *range = argument;
    range->sum = 0U;
    for (uint64_t value = range->first; value <= range->last; ++value) {
        range->sum += value;
    }
    return NULL;
}

static int join_threads(pthread_t *threads, size_t count)
{
    int status = 0;
    for (size_t index = 0U; index < count; ++index) {
        const int error = pthread_join(threads[index], NULL);
        if (error != 0) {
            fprintf(stderr, "pthread_join failed: %s\n", strerror(error));
            status = 1;
        }
    }
    return status;
}

int main(void)
{
    pthread_t threads[2];
    struct WorkRange ranges[2] = {
        {1U, 500000U, 0U},
        {500001U, 1000000U, 0U}
    };
    size_t created = 0U;

    for (; created < 2U; ++created) {
        const int error = pthread_create(
            &threads[created], NULL, sum_range, &ranges[created]
        );
        if (error != 0) {
            fprintf(stderr, "pthread_create failed: %s\n", strerror(error));
            join_threads(threads, created);
            return 1;
        }
    }

    if (join_threads(threads, created) != 0) {
        return 1;
    }

    const uint64_t actual = ranges[0].sum + ranges[1].sum;
    const uint64_t expected = ((uint64_t)1000000U * 1000001U) / 2U;
    if (actual != expected) {
        fprintf(stderr, "pthread sum mismatch.\n");
        return 1;
    }

    printf("pthread smoke passed: sum=%llu\n", (unsigned long long)actual);
    return 0;
}
