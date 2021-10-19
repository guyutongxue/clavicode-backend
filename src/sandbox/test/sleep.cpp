#include <cstdlib>

int a[1000000];

int main() {
  for (volatile int i{0}; i < 1000000; ++i) {
    a[i] = rand();
    for (volatile int i{0}; i < 1000; ++i) {
      a[i] = rand();
    }
  }
}
