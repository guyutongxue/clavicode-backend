#include <fstream>
#include <string>
#include <iostream>

int main() {
  std::ifstream ifs("../test/read.cpp");
  std::string line;
  while (std::getline(ifs, line)) {
    std::cout << line << std::endl;
  }
}
