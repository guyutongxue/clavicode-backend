#include <string>
#include <vector>

struct Config {
  std::string executable_path;
  std::string input_path;
  std::string output_path;
  std::vector<std::string> arguments;
  std::vector<std::string> environment;
  std::string log_path;
  std::int64_t uid;
  std::int64_t gid;
  std::int64_t max_cpu_time;
  std::int64_t max_memory;
  std::int64_t max_stack;
  std::int64_t max_process_number;
  std::int64_t max_output_size;
};
