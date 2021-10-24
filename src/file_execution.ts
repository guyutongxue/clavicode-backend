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
import { FileExecutionResult } from './api';
import path from 'path';
import { constants } from 'os';

type SandboxResult = {
  success: boolean;
  cpu_time: number;
  real_time: number;
  memory: number;
  signal: number;
  exit_code: number;
  result: number;

};

export function fileExecution(exePath: string, stdin: string): Promise<FileExecutionResult> {
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
    execFile(path.join(__dirname, 'sandbox/bin/sandbox'), [
      `--exe_path=${exePath}`,
      '--max_real_time=1000',
      `--input_path=${tmpStdinFile.name}`,
      `--output_path=${tmpStdoutFile.name}`,
      `--error_path=${tmpStderrFile.name}`,
      `--result_path=${tmpResultFile.name}`,
      `--log_path=/dev/null`
    ],
      (error) => {
        if (error) {
          // 沙盒主进程崩溃
          console.log('Fail to execute');
          resolve({
            result: 'error',
            reason: 'system',
            stderr: '',
            stdout: ''
          });
        } else {
          // 沙盒执行完成
          try {
            const resultIo = {
              stdout: fs.readFileSync(tmpStdoutFile.name, 'utf-8'),
              stderr: fs.readFileSync(tmpStderrFile.name, 'utf-8')
            };
            const result: SandboxResult = JSON.parse(fs.readFileSync(tmpResultFile.name, 'utf-8'));
            console.log(result);
            tmpStdoutFile.removeCallback();
            tmpStderrFile.removeCallback();
            tmpResultFile.removeCallback();
            if (!result.success) throw new Error("Sandbox failed");
            if (result.result === 0) {
              // SUCCESS
              resolve({
                result: 'ok',
                exitCode: result.exit_code,
                ...resultIo
              });
            } else if (result.result === 1 || result.result === 2) {
              // CPU_TIME_LIMIT_EXCEEDED, REAL_TIME_LIMIT_EXCEEDED,
              resolve({
                result: 'error',
                reason: 'timeout',
                ...resultIo
              });
            } else if (result.result === 3) {
              // MEMORY_LIMIT_EXCEEDED
              resolve({
                result: 'error',
                reason: 'memout',
                ...resultIo
              });
            } else if (result.result === 4) {
              // RUNTIME_ERROR
              resolve({
                result: 'error',
                reason: result.signal === constants.signals.SIGSYS ? 'violate' : 'other',
                ...resultIo
              });
            } else {
              resolve({
                result: 'error',
                reason: 'system',
                ...resultIo
              });
            }
          } catch (_) {
            resolve({
              result: 'error',
              reason: 'system',
              stderr: '',
              stdout: ''
            });
          }
        }
      });
  });
}
