CC = gcc
CFLAGS = -std=c11 -Wall -Wextra -Werror -pedantic -O0 -g
OUT = coverage
OBJECTS = $(OUT)/ring_buffer.o $(OUT)/test_ring_buffer.o

.PHONY: all test coverage clean
all: test

$(OUT)/%.o: %.c ring_buffer.h
	mkdir -p $(OUT)
	$(CC) $(CFLAGS) --coverage -c $(abspath $<) -o $@

$(OUT)/test_ring_buffer: $(OBJECTS)
	$(CC) $(CFLAGS) --coverage $^ -o $@

test: $(OUT)/test_ring_buffer
	./$(OUT)/test_ring_buffer

coverage:
	$(MAKE) clean
	$(MAKE) test
	cd $(OUT) && gcov -b -c ring_buffer.gcno
	lcov --capture --directory $(OUT) --output-file $(OUT)/all.info --rc branch_coverage=1
	lcov --extract $(OUT)/all.info '*/ring_buffer.c' --output-file $(OUT)/lcov.info --rc branch_coverage=1
	genhtml $(OUT)/lcov.info --output-directory $(OUT)/html --branch-coverage
	lcov --summary $(OUT)/lcov.info --rc branch_coverage=1

clean:
	$(RM) -r $(OUT)
