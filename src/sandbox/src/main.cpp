#include <boost/program_options.hpp>
#include <iostream>

#include "config.h"
#include "runner.h"

using namespace std::literals;


void print_version() {
  std::clog << "Sandbox (used by clavicode-backend), v" PROJECT_VERSION << std::endl;
}

int main(int argc, char** argv) {
  namespace po = boost::program_options;
  po::options_description desc("Allowed options");
  SandboxConfig config;

  #define OPTION(name, default_val, desc) \
    (#name, po::value<decltype(config.name)>(&config.name)->default_value(default_val), desc)
  #define OPTION_VEC(name, desc) \
    (#name, po::value<decltype(config.name)>(&config.name)->composing(), desc)

  // clang-format off
  desc.add_options()
    ("help,h", "Display help message and exit.")
    ("version,v", "Display version info and exit.")
    OPTION(max_cpu_time, UNLIMITED, "Max CPU time (ms)")
    OPTION(max_real_time, UNLIMITED, "Max real time (ms)")
    OPTION(max_memory, UNLIMITED, "Max memory (B)")
    OPTION(max_stack, 16L * 1024 * 1024, "Max stack (B)")
    OPTION(max_process_number, UNLIMITED, "Max process number")
    OPTION(max_output_size, UNLIMITED, "Max output size (B)")
    OPTION(exe_path, ""s, "Executable path")
    OPTION(input_path, "/dev/stdin"s, "Input path")
    OPTION(output_path, "/dev/stdout"s, "Output path")
    OPTION(error_path, "/dev/stderr"s, "Error path")
    OPTION_VEC(args, "Arguments")
    OPTION_VEC(env, "Environment variables")
    OPTION(log_path, "sandbox.log"s, "Log path")
    OPTION(uid, 65534, "User ID")
    OPTION(gid, 65534, "Group ID")
  ;
  // clang-format on

  #undef OPTION
  #undef OPTION_VEC

  po::variables_map vm;
  try {
    po::store(po::parse_command_line(argc, argv, desc), vm);
    po::notify(vm);
  } catch (const po::error& e) {
    std::cerr << "Command line error: " << e.what() << std::endl;
    std::cerr << "sandbox --help' for more information." << std::endl;
    std::exit(1);
  }

  if (vm.count("help")) {
    print_version();
    std::clog << desc << std::endl;
    std::exit(0);
  }
  if (vm.count("version")) {
    print_version();
    std::exit(0);
  }

  if (config.exe_path.empty()) {
    std::cerr << "Command line error: Executable path is not specified." << std::endl;
    std::exit(1);
  }

  auto result{run(config)};

  std::clog << result << std::endl;
}
