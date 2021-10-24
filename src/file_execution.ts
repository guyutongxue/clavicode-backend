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


import * as fs from 'fs';
import * as tmp from 'tmp';
import { execFile } from 'child_process';
import { CppCompileFileResponse, RuntimeError } from './api';
type Result = {
  success: boolean;
  cpu_time: number;
  real_time: number;
  memory: number;
  signal: number;
  exit_code: number;
  result: number;

};

type FileExecutionResponse = {
  result: 'ok' | 'error';
  exitCode?: number;      // If result is 'ok'
  reason?: RuntimeError;  // If result is 'error'
  stdout: string;
  stderr: string;
}

export function fileExecution(exePath: string, stdin: string): Promise<FileExecutionResponse> {
  const tmpStdinFile = tmp.fileSync({
    postfix: ".txt"
  });
  fs.writeFileSync(tmpStdinFile.fd, stdin);
  const tmpStderrFile = tmp.fileSync({
    postfix: ".txt"
  });
  const tmpStdoutFile = tmp.fileSync({
    postfix: ".txt"
  });
  const tmpResultFile = tmp.fileSync({
    postfix: ".json"
  });
  return new Promise((resolve) => {
    execFile('./sandbox/bin/sandbox', [
      `--exe_path=${exePath}`,
      '--max_real_time=1000',
      `--input_path=${tmpStdinFile}`,
      `--output_path=${tmpStdoutFile}`,
      `--error_path=${tmpStderrFile}`,
      `--result_path=${tmpResultFile}`
    ],
      (error) => {
        if (error) {//在运行“执行文件函数”的过程中出现错误，基本不可能发生
          console.log('fail to execute');
          resolve({
            result: 'error',
            reason: 'system',
            stderr: 'none',
            stdout: 'none',

          });
        }
        else {// 成功执行文件
          const stdout = fs.readFileSync(tmpStdoutFile.name).toString();
          const stderr = fs.readFileSync(tmpStderrFile.name).toString();
          const result: Result = JSON.parse(fs.readFileSync(tmpResultFile.name).toString());
          tmpStdoutFile.removeCallback();
          tmpStderrFile.removeCallback();
          tmpResultFile.removeCallback();
          if (result.success) {//运行成功，顺利返回
            resolve({
              stdout: stdout,
              stderr: stderr,
              exitCode: result.exit_code,
              result: 'ok',
            });
          } else {//执行失败，查看result
            if (result.result === 1 || result.result === 2) {//CPU_TIME_LIMIT_EXCEEDED,
              // REAL_TIME_LIMIT_EXCEEDED,
              resolve({
                result: 'error',
                reason: 'timeout',
                stdout: stdout,
                stderr: stderr,
              });
            } else if (result.result === 3) {//MEMORY_LIMIT_EXCEEDED,
              resolve({
                result: 'error',
                reason: 'memout',
                stdout: stdout,
                stderr: stderr,
              });
            }
            else if(result.result===4){
              if(result.signal===31){
                resolve({
                  result: 'error',
                  reason: 'violate',
                  stdout: stdout,
                  stderr: stderr,
                });
              }
              else{
                resolve({
                  result: 'error',
                  reason: 'other',
                  stdout: stdout,
                  stderr: stderr,
                });
              }
            }
          }
        }
      });
  });
}
