#include <stdio.h>

static int classify(int value)
{
    if (value > 0) {
        return 1;
    }
    return 0;
}

int main(void)
{
    int positive = classify(1);
    int negative = classify(-1);
    puts("C environment smoke test passed");
    return positive == 1 && negative == 0 ? 0 : 1;
}
