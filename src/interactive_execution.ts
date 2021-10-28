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

import cp from 'child_process';
import { SIGKILL } from 'constants';
import path from 'path';
import ws from "ws";
import { WsExecuteC2S } from './api';
import { TEMP_EXECUTE_TOKEN } from './constant';
export function findExecution(token: string): string | null {
  if (token === TEMP_EXECUTE_TOKEN) {
    return "../test/_chat";
  } else return null;
}
export function interactiveExecution(ws: ws, filename: string) {
  ws.on('message', function (WsRequest: WsExecuteC2S) {
    let sandbox_process: cp.ChildProcessWithoutNullStreams = cp.spawn('sleep', ['--version']);
    if (WsRequest.type === 'start') {
      sandbox_process = cp.spawn("./sandbox",
        [
          `--exe_path=${filename}`
        ], {
        stdio: 'pipe',
        cwd: path.join(__dirname, "sandbox/bin")
      });
      ws.send({ type: 'started' });
      sandbox_process.stdout.on('data', (data: Buffer) => {
        const stdout = data.toString('utf-8');
        ws.send({
          type: 'output', stream: 'stdout', content: stdout,
        });
      });
      sandbox_process.stderr.on('data', (data: Buffer) => {
        const stderr = data.toString('utf-8');
        ws.send({
          type: 'stderr', stream: 'stdout', content: stderr,
        });
      });
      sandbox_process.on('exit', (code) => {
        ws.send({ type: 'closed', exitCode: code });
      });
    }
    else if (WsRequest.type === 'shutdown') {
      if (sandbox_process.pid)
        process.kill(sandbox_process.pid, SIGKILL);
    }
    else if (WsRequest.type === 'eof') {
      sandbox_process.stdin.end();
    }
    else if (WsRequest.type === 'input') {
      const input = WsRequest.content;
      sandbox_process.stdin.write(Buffer.from(input, 'utf-8'));
    }
  });
}
