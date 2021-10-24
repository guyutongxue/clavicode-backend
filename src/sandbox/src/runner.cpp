// Copyright (C) 2021 Clavicode Team
//
// This file is part of clavicode-backend.
//
// clavicode-backend is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// clavicode-backend is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with clavicode-backend.  If not, see <http://www.gnu.org/licenses/>.

#include "runner.h"

#include <fcntl.h>
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
  if (result.error == ErrorType::SUCCESS) {
    os << "{\n  \"success\": true"
       << ",\n  \"cpu_time\": " << result.cpu_time
       << ",\n  \"real_time\": " << result.real_time
       << ",\n  \"memory\": " << result.memory
       << ",\n  \"signal\": " << result.signal
       << ",\n  \"exit_code\": " << result.exit_code
       << ",\n  \"result\": " << static_cast<int>(result.result) << "\n}";
  } else {
    os << "{\n  \"success\": false"
       << ",\n  \"error\": " << static_cast<int>(result.error) << "\n}";
  }
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

  // uid_t uid{getuid()};
  // if (uid != 0L) {
  //   error_exit(ErrorType::ROOT_REQUIRED);
  // }

  if ((config.max_cpu_time < 1 && config.max_cpu_time != UNLIMITED) ||
      (config.max_real_time < 1 && config.max_real_time != UNLIMITED) ||
      (config.max_stack < 1) ||
      (config.max_memory < 1 && config.max_memory != UNLIMITED) ||
      (config.max_process_number < 1 &&
       config.max_process_number != UNLIMITED) ||
      (config.max_output_size < 1 && config.max_output_size != UNLIMITED)) {
    error_exit(ErrorType::INVALID_CONFIG);
  }

  // Try to pipe io of child process to
  int stdin_pipe[2];
  int stdout_pipe[2];
  int stderr_pipe[2];
  if (pipe(stdin_pipe) < 0 || pipe(stdout_pipe) < 0 || pipe(stderr_pipe) < 0) {
    error_exit(ErrorType::DUP2_FAILED);
  }

  timeval start, end;
  gettimeofday(&start, nullptr);

  pid_t child_pid{fork()};
  if (child_pid < 0) {
    error_exit(ErrorType::FORK_FAILED);
  }
  if (child_pid == 0) {
    // child process
    close(stdin_pipe[1]);
    close(stdout_pipe[0]);
    close(stderr_pipe[0]);
    if (dup2(stdin_pipe[0], STDIN_FILENO) < 0 ||
        dup2(stdout_pipe[1], STDOUT_FILENO) < 0 ||
        dup2(stderr_pipe[1], STDERR_FILENO) < 0) {
      error_exit(ErrorType::DUP2_FAILED);
    }
    close(stdin_pipe[0]);
    close(stdout_pipe[1]);
    close(stderr_pipe[1]);
    
    child(config);
  } else {
    // parent process

    // prepare for forwarding child process's io
    close(stdin_pipe[0]);
    close(stdout_pipe[1]);
    close(stderr_pipe[1]);
    fcntl(STDIN_FILENO, F_SETFL, fcntl(STDIN_FILENO, F_GETFL, 0) | O_NONBLOCK);

    if (config.max_real_time != UNLIMITED) {
      std::thread killer([&]() {
        sleep((config.max_real_time + 1000) / 1000);
        kill(child_pid, SIGKILL);
      });
      killer.detach();
    }

    int status;
    int retval;
    rusage resource_usage;

    std::thread read_stdout([&]() {
      int size;
      char buf[256];
      while ((size = read(stdout_pipe[0], buf, sizeof(buf)))) {
        if (size == -1) {
          if (errno != EINTR) {
            kill(child_pid, SIGKILL);
            error_exit(ErrorType::FORWARD_IO_FAILED);
          }
        } else {
          write(STDOUT_FILENO, buf, size);
        }
      }
      close(stdout_pipe[0]);
    });
    std::thread read_stderr([&]() {
      char size;
      char buf[256];
      while ((size = read(stderr_pipe[0], buf, sizeof(buf)))) {
        if (size == -1) {
          if (errno != EINTR) {
            kill(child_pid, SIGKILL);
            error_exit(ErrorType::FORWARD_IO_FAILED);
          }
        } else {
          write(STDERR_FILENO, buf, size);
        }
      }
      close(stderr_pipe[0]);
    });

    while ((retval = wait4(child_pid, &status, WNOHANG | WSTOPPED,
                           &resource_usage)) != child_pid) {
      if (retval == -1) {
        kill(child_pid, SIGKILL);
        error_exit(ErrorType::WAIT_FAILED);
      }

      // Forward child process io
      int size;
      char buf[256];
      if ((size = read(STDIN_FILENO, buf, sizeof(buf))) == -1) {
        if (errno != EAGAIN && errno != EINTR) {
          kill(child_pid, SIGKILL);
          error_exit(ErrorType::FORWARD_IO_FAILED);
        }
      } else if (size == 0) {
        // EOF
        close(stdin_pipe[1]);
      } else {
        write(stdin_pipe[1], buf, size);
      }
    }
    read_stdout.join();
    read_stderr.join();

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
      // if (result.exit_code) {
      //   result.result = ResultType::RUNTIME_ERROR;
      // }
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
