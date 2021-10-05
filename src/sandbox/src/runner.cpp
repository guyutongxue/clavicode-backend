#include "runner.h"

#include <iostream>

std::ostream& operator<<(std::ostream& os, const SandboxResult& result) {
  os << "{\n    \"cpu_time\": " << result.cpu_time
     << ",\n    \"real_time\": " << result.real_time
     << ",\n    \"memory\": " << result.memory
     << ",\n    \"signal\": " << result.signal
     << ",\n    \"exit_code\": " << result.exit_code
     << ",\n    \"error\": " << result.error
     << ",\n    \"result\": " << result.result << "\n}";
  return os;
}

SandboxResult run(const SandboxConfig& config) {
  static_cast<void>(config);
  return {};
}
