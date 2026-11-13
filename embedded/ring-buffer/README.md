# Embedded byte ring buffer

[Repository README](../../README.md)

This standalone C11 FIFO stores bytes in caller-owned memory. It has no heap
allocation, operating-system calls, or web application dependencies. All storage
slots are usable; a one-byte capacity is supported.

## Contract

Include `ring_buffer.h` and compile `ring_buffer.c` with the calling program.
Initialize each object with `rb_init` before any other operation. The caller
provides nonzero-capacity storage and keeps it alive for the buffer's lifetime.
The object fields are internal and must not be changed directly. Output pointers
and the buffer object must not overlap the byte storage.

- `rb_push` appends one byte; a full buffer returns `RB_FULL` without overwriting.
- `rb_pop` removes the oldest byte; an empty buffer returns `RB_EMPTY`.
- `rb_peek` reads the oldest byte without removing it.
- `rb_clear` empties the buffer without erasing the underlying bytes.
- Invalid pointers, zero initialization capacity, and invalid state bounds return
  `RB_INVALID_ARGUMENT`. C cannot verify the size or lifetime of caller memory.
- Failed operations leave buffer state and output values unchanged.
- Indices wrap at the storage boundary without requiring a power-of-two capacity.
- Calls are not atomic or thread/interrupt safe. Callers must provide synchronization
  when sharing a buffer across execution contexts.

## Build and coverage

Prerequisites: GCC with matching gcov, GNU Make, lcov, and genhtml.

From this directory:

```sh
make test
make coverage
```

The three tests check FIFO byte order, repeated non-destructive peeking, and
clearing followed by reuse. Checks remain active when `NDEBUG` is defined.
Compilation uses C11, warnings as errors, debug information, and GCC coverage
instrumentation.

`make coverage` removes previous component build data, builds and runs the tests,
runs gcov with branch counts, captures LCOV data, and generates HTML. The final
LCOV and HTML reports include `ring_buffer.c`, excluding the test harness.

Generated outputs (ignored by Git):

- `coverage/ring_buffer.c.gcov`: annotated source and branch counts.
- `coverage/lcov.info`: LCOV component data.
- `coverage/html/index.html`: navigable HTML report.
- `coverage/all.info`: capture including the test harness.

`make clean` removes this directory's generated `coverage/` tree. Coverage
percentages describe executed code, not a guarantee of correctness.

## Measured coverage

Running `make coverage` with GCC/gcov 13.3.0 and LCOV 2.0 produced:

| Metric | Covered / total | Coverage |
| --- | --- | --- |
| Lines | 37 / 45 | 82.22% |
| Functions, including the internal state checker | 6 / 6 | 100.00% |
| Branch outcomes | 20 / 40 | 50.00% |

gcov reports that all branch sites were executed; half of their outcomes were
taken. The line and branch totals above exclude the test harness.
