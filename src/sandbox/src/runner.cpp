#include "runner.h"

#include <sys/resource.h>
#include <sys/time.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#include <boost/log/core.hpp>
#include <boost/log/trivial.hpp>
#include <boost/log/utility/setup.hpp>
#include <iostream>
#include <thread>

#include "child.h"

std::ostream& operator<<(std::ostream& os, const SandboxResult& result) {
  os << "{\n    \"cpu_time\": " << result.cpu_time
     << ",\n    \"real_time\": " << result.real_time
     << ",\n    \"memory\": " << result.memory
     << ",\n    \"signal\": " << result.signal
     << ",\n    \"exit_code\": " << result.exit_code
     << ",\n    \"error\": " << static_cast<int>(result.error)
     << ",\n    \"result\": " << static_cast<int>(result.result) << "\n}";
  return os;
}

namespace {

[[noreturn]] void error_exit(ErrorType e) {
  BOOST_LOG_TRIVIAL(fatal) << "Fatal error: " << error_msg[static_cast<int>(e)];
  std::abort();
}

}  // namespace

SandboxResult run(const SandboxConfig& config) {
  namespace logging = boost::log;
  logging::add_file_log(
      boost::log::keywords::file_name = config.log_path,
      boost::log::keywords::target_file_name = config.log_path,
      boost::log::keywords::format = "[%TimeStamp%][%Severity%] %Message%",
      boost::log::keywords::auto_flush = true);
  logging::add_common_attributes();
  BOOST_LOG_TRIVIAL(info) << "Runner start to run.";

  SandboxResult result{};

  uid_t uid{getuid()};
  if (uid != 0L) {
    error_exit(ErrorType::ROOT_REQUIRED);
  }

  if ((config.max_cpu_time < 1 && config.max_cpu_time != UNLIMITED) ||
      (config.max_real_time < 1 && config.max_real_time != UNLIMITED) ||
      (config.max_stack < 1) ||
      (config.max_memory < 1 && config.max_memory != UNLIMITED) ||
      (config.max_process_number < 1 &&
       config.max_process_number != UNLIMITED) ||
      (config.max_output_size < 1 && config.max_output_size != UNLIMITED)) {
    error_exit(ErrorType::INVALID_CONFIG);
  }

  timeval start, end;
  gettimeofday(&start, nullptr);

  pid_t child_pid{fork()};
  if (child_pid < 0) {
    error_exit(ErrorType::FORK_FAILED);
  }
  if (child_pid == 0) {
    // child process
    child(config);
  } else {
    // parent process
    if (config.max_real_time != UNLIMITED) {
      std::thread killer([&]() {
        sleep((config.max_real_time + 1000) / 1000);
        kill(child_pid, SIGKILL);
      });
      killer.detach();
    }

    int status;
    rusage resource_usage;
    if (wait4(child_pid, &status, WSTOPPED, &resource_usage) == -1) {
      kill(child_pid, SIGKILL);
      error_exit(ErrorType::WAIT_FAILED);
    }

    gettimeofday(&end, nullptr);
    result.real_time = static_cast<int>((end.tv_sec - start.tv_sec) * 1000 +
                                        (end.tv_usec - start.tv_usec) / 1000);

    if (WIFSIGNALED(status) != 0) {
      result.signal = WTERMSIG(status);
    }

    if (result.signal == SIGUSR1) {
      result.result = ResultType::SYSTEM_ERROR;
    } else {
      result.exit_code = WEXITSTATUS(status);
      result.cpu_time =
          static_cast<int>(resource_usage.ru_utime.tv_sec * 1000 +
                           resource_usage.ru_utime.tv_usec / 1000);
      result.memory = resource_usage.ru_maxrss * 1024;
      if (result.exit_code) {
        result.result = ResultType::RUNTIME_ERROR;
      }
      if (result.signal == SIGSEGV) {
        if (config.max_memory != UNLIMITED &&
            result.memory > config.max_memory) {
          result.result = ResultType::MEMORY_LIMIT_EXCEEDED;
        } else {
          result.result = ResultType::RUNTIME_ERROR;
        }
      } else {
        if (result.signal != 0) {
          result.result = ResultType::RUNTIME_ERROR;
        }
        if (config.max_memory != UNLIMITED &&
            result.memory > config.max_memory) {
          result.result = ResultType::MEMORY_LIMIT_EXCEEDED;
        }
        if (config.max_real_time != UNLIMITED &&
            result.real_time > config.max_real_time) {
          result.result = ResultType::REAL_TIME_LIMIT_EXCEEDED;
        }
        if (config.max_cpu_time != UNLIMITED &&
            result.cpu_time > config.max_cpu_time) {
          result.result = ResultType::CPU_TIME_LIMIT_EXCEEDED;
        }
      }
    }
  }
  return result;
}
