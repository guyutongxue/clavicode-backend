#include <iostream>
#include <string>

int main() {
  std::string line;
  while (std::getline(std::cin, line)) {
    std::cout << "You've input " << line.length() << " characters!" << std::endl;
  }
}
