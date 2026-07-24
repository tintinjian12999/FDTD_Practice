#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    const size_t count = 4096U;
    uint64_t *values = calloc(count, sizeof(*values));

    if (values == NULL) {
        fprintf(stderr, "Memory allocation failed for %zu elements.\n", count);
        return 1;
    }

    uint64_t sum = 0U;
    for (size_t index = 0U; index < count; ++index) {
        if (values[index] != 0U) {
            fprintf(stderr, "calloc did not zero element %zu.\n", index);
            free(values);
            return 1;
        }
        values[index] = (uint64_t)index;
        sum += values[index];
    }

    free(values);

    const uint64_t expected = ((uint64_t)count * (count - 1U)) / 2U;
    if (sum != expected) {
        fprintf(stderr, "Memory smoke sum mismatch.\n");
        return 1;
    }

    printf("Memory smoke passed: sum=%llu\n", (unsigned long long)sum);
    return 0;
}
