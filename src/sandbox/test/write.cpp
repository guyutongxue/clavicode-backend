#include <fstream>

int main() {
  std::ofstream ofs("/tmp/hello");
  ofs << "Hello, world!" << std::endl;
}
