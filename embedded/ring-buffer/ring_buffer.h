#ifndef RING_BUFFER_H
#define RING_BUFFER_H

#include <stddef.h>
#include <stdint.h>

typedef enum {
    RB_OK = 0,
    RB_INVALID_ARGUMENT,
    RB_FULL,
    RB_EMPTY
} rb_status;

/* Initialize before use; fields are internal and must not be modified directly.
 * Storage must outlive the buffer. Calls require external synchronization.
 * The buffer object and output pointers must not overlap its byte storage. */
typedef struct {
    uint8_t *storage;
    size_t capacity;
    size_t head;
    size_t tail;
    size_t count;
} ring_buffer;

rb_status rb_init(ring_buffer *buffer, uint8_t *storage, size_t capacity);
rb_status rb_push(ring_buffer *buffer, uint8_t value);
rb_status rb_pop(ring_buffer *buffer, uint8_t *value);
rb_status rb_peek(const ring_buffer *buffer, uint8_t *value);
rb_status rb_clear(ring_buffer *buffer);

#endif
