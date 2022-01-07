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

#include "child.h"

#include <asm/prctl.h>
#include <fcntl.h>
#include <grp.h>
#include <seccomp.h>
#include <signal.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/utsname.h>
#include <unistd.h>

#include <boost/log/core.hpp>
#include <boost/log/trivial.hpp>
#include <cstdlib>

namespace {

FILE* input_file{nullptr};
FILE* output_file{nullptr};
FILE* error_file{nullptr};

[[noreturn]] void child_error_exit(ErrorType e) {
  BOOST_LOG_TRIVIAL(fatal) << "Fatal error in child: "
                           << error_msg[static_cast<int>(e)];
  BOOST_LOG_TRIVIAL(error) << "Errno: " << strerror(errno);
  if (input_file) {
    fclose(input_file);
    input_file = nullptr;
  }
  if (output_file) {
    fclose(output_file);
    output_file = nullptr;
  }
  if (error_file) {
    fclose(error_file);
    error_file = nullptr;
  }
  raise(SIGUSR1);
  std::exit(EXIT_FAILURE);
}

ErrorType c_cpp_seccomp_rules(const SandboxConfig& config) {
  int syscalls_whitelist[]{
      SCMP_SYS(read),       SCMP_SYS(fstat),         SCMP_SYS(mmap),
      SCMP_SYS(mprotect),   SCMP_SYS(munmap),        SCMP_SYS(uname),
      SCMP_SYS(arch_prctl), SCMP_SYS(brk),           SCMP_SYS(access),
      SCMP_SYS(exit_group), SCMP_SYS(close),         SCMP_SYS(readlink),
      SCMP_SYS(sysinfo),    SCMP_SYS(write),         SCMP_SYS(writev),
      SCMP_SYS(lseek),      SCMP_SYS(clock_gettime), SCMP_SYS(getpid),
      SCMP_SYS(gettid)};

  int debug_whitelist[]{SCMP_SYS(set_tid_address), SCMP_SYS(set_robust_list),
                        SCMP_SYS(prlimit64), SCMP_SYS(getrandom),
                        SCMP_SYS(newfstatat)};

  scmp_filter_ctx ctx{seccomp_init(SCMP_ACT_KILL)};
  if (!ctx) {
    return ErrorType::LOAD_SECCOMP_FAILED;
  }
  for (auto sysc : syscalls_whitelist) {
    if (seccomp_rule_add(ctx, SCMP_ACT_ALLOW, sysc, 0) != 0) {
      return ErrorType::LOAD_SECCOMP_FAILED;
    }
  }
  if (config.debug_mode) {
    for (auto sysc : debug_whitelist) {
      if (seccomp_rule_add(ctx, SCMP_ACT_ALLOW, sysc, 0) != 0) {
        return ErrorType::LOAD_SECCOMP_FAILED;
      }
    }
  }
  // add extra rule for execve
  if (seccomp_rule_add(
          ctx, SCMP_ACT_ALLOW, SCMP_SYS(execve), 1,
          SCMP_A0(SCMP_CMP_EQ, (scmp_datum_t)(config.exe_path.c_str()))) != 0) {
    return ErrorType::LOAD_SECCOMP_FAILED;
  }

  // allow std::abort
  if (seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(rt_sigprocmask), 0) != 0) {
    return ErrorType::LOAD_SECCOMP_FAILED;
  }
  if (seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(tgkill), 2,
                       SCMP_A0(SCMP_CMP_EQ, (scmp_datum_t)(getpid())),
                       SCMP_A1(SCMP_CMP_EQ, (scmp_datum_t)(gettid()))) != 0) {
    return ErrorType::LOAD_SECCOMP_FAILED;
  }

  // no write file
  if (seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(open), 1,
                       SCMP_A1(SCMP_CMP_MASKED_EQ, O_WRONLY | O_RDWR, 0)) !=
      0) {
    return ErrorType::LOAD_SECCOMP_FAILED;
  }
  if (seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(openat), 1,
                       SCMP_A2(SCMP_CMP_MASKED_EQ, O_WRONLY | O_RDWR, 0)) !=
      0) {
    return ErrorType::LOAD_SECCOMP_FAILED;
  }
  if (seccomp_load(ctx) != 0) {
    return ErrorType::LOAD_SECCOMP_FAILED;
  }
  seccomp_release(ctx);
  return ErrorType::SUCCESS;
}

}  // namespace

[[noreturn]] void child(const SandboxConfig& config) {
  // max_stack
  if (config.max_stack != UNLIMITED) {
    rlimit r;
    r.rlim_cur = config.max_stack;
    r.rlim_max = config.max_stack;
    if (setrlimit(RLIMIT_STACK, &r) != 0) {
      child_error_exit(ErrorType::SETRLIMIT_FAILED);
    }
  }
  BOOST_LOG_TRIVIAL(info) << "max_stack: " << config.max_stack;

  // max_memory
  if (config.max_memory != UNLIMITED) {
    rlimit r;
    r.rlim_cur = config.max_memory;
    r.rlim_max = config.max_memory;
    if (setrlimit(RLIMIT_AS, &r) != 0) {
      child_error_exit(ErrorType::SETRLIMIT_FAILED);
    }
  }
  BOOST_LOG_TRIVIAL(info) << "max_memory: " << config.max_memory;

  // max_cpu_time
  if (config.max_cpu_time != UNLIMITED) {
    rlim_t max_cpu_time = (config.max_cpu_time + 1000) / 1000;
    rlimit r;
    r.rlim_cur = max_cpu_time;
    r.rlim_max = max_cpu_time;
    if (setrlimit(RLIMIT_CPU, &r) != 0) {
      child_error_exit(ErrorType::SETRLIMIT_FAILED);
    }
  }
  BOOST_LOG_TRIVIAL(info) << "max_cpu_time: " << config.max_cpu_time;

  // max_process_number
  if (config.max_process_number != UNLIMITED) {
    rlimit r;
    r.rlim_cur = config.max_process_number;
    r.rlim_max = config.max_process_number;
    if (setrlimit(RLIMIT_NPROC, &r) != 0) {
      child_error_exit(ErrorType::SETRLIMIT_FAILED);
    }
  }
  BOOST_LOG_TRIVIAL(info) << "max_process_number: "
                          << config.max_process_number;

  // max_output_size
  if (config.max_output_size != UNLIMITED) {
    rlimit r;
    r.rlim_cur = config.max_output_size;
    r.rlim_max = config.max_output_size;
    if (setrlimit(RLIMIT_FSIZE, &r) != 0) {
      child_error_exit(ErrorType::SETRLIMIT_FAILED);
    }
  }
  BOOST_LOG_TRIVIAL(info) << "max_output_size: " << config.max_output_size;

  if (!config.input_path.empty()) {
    input_file = fopen(config.input_path.c_str(), "r");
    if (!input_file) {
      child_error_exit(ErrorType::DUP2_FAILED);
    }
    // redirect file input to stdin
    if (dup2(fileno(input_file), STDIN_FILENO) == -1) {
      child_error_exit(ErrorType::DUP2_FAILED);
    }
  }

  if (!config.output_path.empty()) {
    output_file = fopen(config.output_path.c_str(), "w");
    if (!output_file) {
      child_error_exit(ErrorType::DUP2_FAILED);
    }
    // redirect file output to stdout
    if (dup2(fileno(output_file), STDOUT_FILENO) == -1) {
      child_error_exit(ErrorType::DUP2_FAILED);
    }
  }

  if (!config.error_path.empty()) {
    error_file = fopen(config.error_path.c_str(), "w");
    if (!error_file) {
      child_error_exit(ErrorType::DUP2_FAILED);
    }
    // redirect file error to stderr
    if (dup2(fileno(error_file), STDERR_FILENO) == -1) {
      child_error_exit(ErrorType::DUP2_FAILED);
    }
  }
  BOOST_LOG_TRIVIAL(info) << "io redirect finish";

  // // set gid
  // gid_t group_list[]{config.gid};
  // if (setgid(config.gid) != 0 || setgroups(1, group_list) != 0) {
  //   child_error_exit(ErrorType::SETUID_FAILED);
  // }
  // BOOST_LOG_TRIVIAL(info) << "gid: " << config.gid;
  // // set uid
  // if (setuid(config.uid) != 0) {
  //   child_error_exit(ErrorType::SETUID_FAILED);
  // }
  // BOOST_LOG_TRIVIAL(info) << "uid: " << config.uid;

  // load C/C++ seccomp rules
  if (c_cpp_seccomp_rules(config) != ErrorType::SUCCESS) {
    child_error_exit(ErrorType::LOAD_SECCOMP_FAILED);
  }
  // We have set seccomp now, but Boost.Log calls gettimeofday(). 
  // So DO NOT log anything from this point.
  // BOOST_LOG_TRIVIAL(info) << "load seccomp rules finish";

  char* argv[256]{};
  char* envp[256]{};
  for (auto i{0u}; i < config.args.size(); i++) {
    argv[i] = const_cast<char*>(config.args[i].c_str());
  }
  for (auto i{0u}; i < config.env.size(); i++) {
    envp[i] = const_cast<char*>(config.env[i].c_str());
  }
  // BOOST_LOG_TRIVIAL(info) << "copy argv & envp finish";
  execve(config.exe_path.c_str(), argv, envp);
  child_error_exit(ErrorType::EXECVE_FAILED);
}
