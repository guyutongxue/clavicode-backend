#include <string>
#include <vector>

struct SandboxConfig {
  int max_cpu_time;
  int max_real_time;
  long max_memory;
  long max_stack;
  int max_process_number;
  long max_output_size;
  // int memory_limit_check_only;
  std::string exe_path;
  std::string input_path;
  std::string output_path;
  std::string error_path;
  std::vector<std::string> args;
  std::vector<std::string> env;
  std::string log_path;
  // std::string seccomp_rule_name;
  uid_t uid;
  gid_t gid;
};

constexpr const long UNLIMITED{-1};

struct SandboxResult {
  int cpu_time;
  int real_time;
  long memory;
  int signal;
  int exit_code;
  int error;
  int result;
};

std::ostream& operator<<(std::ostream& os, const SandboxResult& result);

SandboxResult run(const SandboxConfig& config);
