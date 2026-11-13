#include "ring_buffer.h"

#include <stdio.h>
#include <stdlib.h>

#define CHECK(expression) do { \
    if (!(expression)) { \
        fprintf(stderr, "%s:%d: %s\n", __FILE__, __LINE__, #expression); \
        exit(EXIT_FAILURE); \
    } \
} while (0)

static void fifo(void)
{
    ring_buffer buffer;
    uint8_t storage[4];
    uint8_t value = 0;
    CHECK(rb_init(&buffer, storage, sizeof storage) == RB_OK);
    CHECK(rb_push(&buffer, 0) == RB_OK);
    CHECK(rb_push(&buffer, 255) == RB_OK);
    CHECK(rb_pop(&buffer, &value) == RB_OK && value == 0);
    CHECK(rb_pop(&buffer, &value) == RB_OK && value == 255);
}

static void peek(void)
{
    ring_buffer buffer;
    uint8_t storage[4];
    uint8_t value = 0;
    CHECK(rb_init(&buffer, storage, sizeof storage) == RB_OK);
    CHECK(rb_push(&buffer, 42) == RB_OK);
    CHECK(rb_peek(&buffer, &value) == RB_OK && value == 42);
    CHECK(rb_peek(&buffer, &value) == RB_OK && value == 42);
    CHECK(rb_pop(&buffer, &value) == RB_OK && value == 42);
}

static void clear_and_reuse(void)
{
    ring_buffer buffer;
    uint8_t storage[4];
    uint8_t value = 0;
    CHECK(rb_init(&buffer, storage, sizeof storage) == RB_OK);
    CHECK(rb_push(&buffer, 17) == RB_OK);
    CHECK(rb_clear(&buffer) == RB_OK);
    CHECK(buffer.count == 0);
    CHECK(rb_push(&buffer, 23) == RB_OK);
    CHECK(rb_pop(&buffer, &value) == RB_OK && value == 23);
}

int main(void)
{
    fifo();
    peek();
    clear_and_reuse();
    puts("PASS: 3 ring buffer tests");
    return EXIT_SUCCESS;
}
