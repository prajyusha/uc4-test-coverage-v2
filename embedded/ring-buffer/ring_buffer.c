#include "ring_buffer.h"

static int valid(const ring_buffer *buffer)
{
    return buffer != NULL && buffer->storage != NULL &&
           buffer->capacity != 0 && buffer->head < buffer->capacity &&
           buffer->tail < buffer->capacity && buffer->count <= buffer->capacity;
}

rb_status rb_init(ring_buffer *buffer, uint8_t *storage, size_t capacity)
{
    if (buffer == NULL || storage == NULL || capacity == 0) {
        return RB_INVALID_ARGUMENT;
    }
    buffer->storage = storage;
    buffer->capacity = capacity;
    buffer->head = 0;
    buffer->tail = 0;
    buffer->count = 0;
    return RB_OK;
}

rb_status rb_push(ring_buffer *buffer, uint8_t value)
{
    if (!valid(buffer)) {
        return RB_INVALID_ARGUMENT;
    }
    if (buffer->count == buffer->capacity) {
        return RB_FULL;
    }
    buffer->storage[buffer->head] = value;
    buffer->head = buffer->head == buffer->capacity - 1 ? 0 : buffer->head + 1;
    ++buffer->count;
    return RB_OK;
}

rb_status rb_pop(ring_buffer *buffer, uint8_t *value)
{
    if (!valid(buffer) || value == NULL) {
        return RB_INVALID_ARGUMENT;
    }
    if (buffer->count == 0) {
        return RB_EMPTY;
    }
    *value = buffer->storage[buffer->tail];
    buffer->tail = buffer->tail == buffer->capacity - 1 ? 0 : buffer->tail + 1;
    --buffer->count;
    return RB_OK;
}

rb_status rb_peek(const ring_buffer *buffer, uint8_t *value)
{
    if (!valid(buffer) || value == NULL) {
        return RB_INVALID_ARGUMENT;
    }
    if (buffer->count == 0) {
        return RB_EMPTY;
    }
    *value = buffer->storage[buffer->tail];
    return RB_OK;
}

rb_status rb_clear(ring_buffer *buffer)
{
    if (!valid(buffer)) {
        return RB_INVALID_ARGUMENT;
    }
    buffer->head = 0;
    buffer->tail = 0;
    buffer->count = 0;
    return RB_OK;
}
