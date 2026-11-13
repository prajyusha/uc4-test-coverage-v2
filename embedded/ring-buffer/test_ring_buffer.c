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

static void invalid_arguments(void)
{
    ring_buffer buffer;
    uint8_t storage[4] = {1, 2, 3, 4};
    uint8_t value = 99;
    CHECK(rb_init(NULL, storage, 4) == RB_INVALID_ARGUMENT);
    CHECK(rb_init(&buffer, NULL, 4) == RB_INVALID_ARGUMENT);
    CHECK(rb_init(&buffer, storage, 0) == RB_INVALID_ARGUMENT);
    CHECK(rb_push(NULL, 1) == RB_INVALID_ARGUMENT);
    CHECK(rb_pop(NULL, &value) == RB_INVALID_ARGUMENT);
    CHECK(rb_peek(NULL, &value) == RB_INVALID_ARGUMENT);
    CHECK(rb_clear(NULL) == RB_INVALID_ARGUMENT);
    CHECK(rb_init(&buffer, storage, 4) == RB_OK);
    CHECK(rb_pop(&buffer, NULL) == RB_INVALID_ARGUMENT);
    CHECK(rb_peek(&buffer, NULL) == RB_INVALID_ARGUMENT);
    /* Deliberately corrupt one field at a time to exercise defensive guards.
     * This is fault injection, not supported caller usage. */
    for (int fault = 0; fault < 6; ++fault) {
        CHECK(rb_init(&buffer, storage, 4) == RB_OK);
        if (fault == 0) buffer.storage = NULL;
        if (fault == 1) buffer.capacity = 0;
        if (fault == 2) buffer.head = 4;
        if (fault == 3) buffer.tail = 4;
        if (fault == 4) buffer.count = 5;
        if (fault == 5) buffer.head = (size_t)-1;
        ring_buffer before = buffer;
        CHECK(rb_push(&buffer, 42) == RB_INVALID_ARGUMENT);
        CHECK(rb_pop(&buffer, &value) == RB_INVALID_ARGUMENT);
        CHECK(rb_peek(&buffer, &value) == RB_INVALID_ARGUMENT);
        CHECK(rb_clear(&buffer) == RB_INVALID_ARGUMENT);
        CHECK(value == 99);
        CHECK(buffer.storage == before.storage && buffer.capacity == before.capacity);
        CHECK(buffer.head == before.head && buffer.tail == before.tail && buffer.count == before.count);
        CHECK(storage[0] == 1 && storage[1] == 2 && storage[2] == 3 && storage[3] == 4);
    }
}

static void full_empty_and_wrap(void)
{
    ring_buffer buffer;
    uint8_t storage[3];
    uint8_t value = 99;
    CHECK(rb_init(&buffer, storage, 3) == RB_OK);
    CHECK(rb_pop(&buffer, &value) == RB_EMPTY && value == 99);
    CHECK(rb_peek(&buffer, &value) == RB_EMPTY && value == 99);
    CHECK(buffer.count == 0 && buffer.head == 0 && buffer.tail == 0);
    for (int round = 0; round < 5; ++round) {
        for (int i = 0; i < 3; ++i) CHECK(rb_push(&buffer, (uint8_t)(round * 3 + i)) == RB_OK);
        CHECK(buffer.count == 3 && buffer.head == 0);
        CHECK(rb_push(&buffer, 255) == RB_FULL);
        CHECK(buffer.count == 3 && buffer.head == 0 && buffer.tail == 0);
        for (int i = 0; i < 3; ++i) {
            CHECK(rb_peek(&buffer, &value) == RB_OK && value == (uint8_t)(round * 3 + i));
            CHECK(buffer.count == (size_t)(3 - i));
            CHECK(rb_pop(&buffer, &value) == RB_OK && value == (uint8_t)(round * 3 + i));
        }
        CHECK(buffer.count == 0 && buffer.tail == 0);
    }
    CHECK(rb_push(&buffer, 1) == RB_OK);
    CHECK(rb_push(&buffer, 2) == RB_OK);
    CHECK(rb_pop(&buffer, &value) == RB_OK && value == 1);
    CHECK(rb_push(&buffer, 3) == RB_OK);
    CHECK(rb_push(&buffer, 4) == RB_OK);
    CHECK(rb_pop(&buffer, &value) == RB_OK && value == 2);
    CHECK(rb_pop(&buffer, &value) == RB_OK && value == 3);
    CHECK(rb_pop(&buffer, &value) == RB_OK && value == 4);
    CHECK(rb_push(&buffer, 5) == RB_OK);
    CHECK(rb_clear(&buffer) == RB_OK);
    CHECK(buffer.head == 0 && buffer.tail == 0 && buffer.count == 0);
    CHECK(rb_clear(&buffer) == RB_OK);
}

static void single_slot(void)
{
    ring_buffer buffer;
    uint8_t storage[1], value = 99;
    CHECK(rb_init(&buffer, storage, 1) == RB_OK);
    for (int i = 0; i < 4; ++i) {
        CHECK(rb_push(&buffer, 255) == RB_OK);
        CHECK(rb_push(&buffer, 0) == RB_FULL);
        CHECK(rb_peek(&buffer, &value) == RB_OK && value == 255);
        CHECK(rb_pop(&buffer, &value) == RB_OK && value == 255);
        CHECK(rb_pop(&buffer, &value) == RB_EMPTY && value == 255);
        CHECK(buffer.head == 0 && buffer.tail == 0 && buffer.count == 0);
    }
}

int main(void)
{
    fifo();
    peek();
    clear_and_reuse();
    invalid_arguments();
    full_empty_and_wrap();
    single_slot();
    puts("PASS: 6 ring buffer test groups");
    return EXIT_SUCCESS;
}
