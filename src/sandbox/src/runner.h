#pragma once

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

enum class ErrorType {
  SUCCESS,
  INVALID_CONFIG,
  FORK_FAILED,
  PTHREAD_FAILED,
  WAIT_FAILED,
  ROOT_REQUIRED,
  LOAD_SECCOMP_FAILED,
  SETRLIMIT_FAILED,
  DUP2_FAILED,
  SETUID_FAILED,
  EXECVE_FAILED,
  SPJ_ERROR
};

constexpr const char* error_msg[12]{"success",
                                    "invalid config",
                                    "fork failed",
                                    "pthread failed",
                                    "wait failed",
                                    "root required",
                                    "load seccomp failed",
                                    "setrlimit failed",
                                    "dup2 failed",
                                    "setuid failed",
                                    "execve failed",
                                    "spj error"};

enum class ResultType {
  SUCCESS,
  CPU_TIME_LIMIT_EXCEEDED,
  REAL_TIME_LIMIT_EXCEEDED,
  MEMORY_LIMIT_EXCEEDED,
  RUNTIME_ERROR,
  SYSTEM_ERROR
};

struct SandboxResult {
  int cpu_time;
  int real_time;
  long memory;
  int signal;
  int exit_code;
  ErrorType error;
  ResultType result;
};

std::ostream& operator<<(std::ostream& os, const SandboxResult& result);

SandboxResult run(const SandboxConfig& config);
