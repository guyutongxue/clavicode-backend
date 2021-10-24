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

export function fileExecution(exePath: string, stdin: string) {
  const tmpStdinFile = tmp.fileSync({
    postfix: ".txt"
  });
  if (stdin) {
    fs.writeFileSync(tmpStdinFile.fd, stdin);
  }
  const tmpStderrFile = tmp.fileSync({
    postfix: ".txt"
  });
  const tmpStdoutFile = tmp.fileSync({
    postfix: ".txt"
  });
  const tmpResultFile = tmp.fileSync({
    postfix: ".txt"
  });
  execFile('./sandbox/bin/sandbox', [
    `--exe_path=${exePath}`,
    '--max_real_time=1000',
    `--input_path=${tmpStdinFile}`,
    `--output_path=${tmpStdoutFile}`,
    `--error_path=${tmpStderrFile}`,
    `result_path=${tmpResultFile}`],
    (error) => {
      if (error) {
        console.log('fail to execute');
        return {
          success: false,
          errorType: 'execute',
          error: error,
        };
      }
      else {// 成功执行文件
        const stdout = fs.readFileSync(tmpStdoutFile.name);
        const stderr = fs.readFileSync(tmpStderrFile.name);
        const result = fs.readFileSync(tmpResultFile.name);
        tmpStdoutFile.removeCallback();
        tmpStderrFile.removeCallback();
        tmpResultFile.removeCallback();
        return {
          success: true,
          stdout: stdout,
          stderr: stderr,
          result: result,
        };
      }
    });
}
