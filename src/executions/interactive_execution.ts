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
import { unlinkSync } from 'fs';
import path from 'path';
import ws from "ws";
import { WsExecuteC2S, WsExecuteS2C } from '../api';
import { TEMP_EXECUTE_TOKEN } from '../constant';
export function findExecution(token: string): string | null {
  if (token === TEMP_EXECUTE_TOKEN) {
    return (global as any)['TEMP_EXECUTE_PROGRAM_PATH'] ?? null;
  } else return null;
}
export function interactiveExecution(ws: ws, filename: string) {
  function send(data: WsExecuteS2C) {
    console.log("sent: ", data);
    ws.send(Buffer.from(JSON.stringify(data)));
  }
  let sandbox_process : null | cp.ChildProcessWithoutNullStreams = null;
  ws.on('message', function (req: Buffer) {
    const reqObj: WsExecuteC2S = JSON.parse(req.toString());
    console.log(reqObj);
    if (reqObj.type === 'start') {
      sandbox_process = cp.spawn("./sandbox",
        [
          `--exe_path=${filename}`,
          '--max_real_time=60000',
        ], {
        stdio: 'pipe',
        cwd: path.join(__dirname, "sandbox/bin")
      });
      if (sandbox_process === null) {
        send({type: 'error', reason: 'system' });
        return;
      }
      send({ type: 'started' });
      sandbox_process.stdout.on('data', (data: Buffer) => {
        const stdout = data.toString('utf-8');
        send({
          type: 'output', 
          stream: 'stdout', 
          content: stdout,
        });
      });
      sandbox_process.stderr.on('data', (data: Buffer) => {
        const stderr = data.toString('utf-8');
        send({
          type: 'output', 
          stream: 'stderr', 
          content: stderr,
        });
      });
      sandbox_process.on('exit', (code) => {
        send({ type: 'closed', exitCode: code ?? 0 });
        unlinkSync(filename);
        (global as any)['TEMP_EXECUTE_PROGRAM_PATH'] = null;
      });
    }
    else if (reqObj.type === 'shutdown') {
      if (sandbox_process === null) return;
      if (sandbox_process.pid)
        process.kill(sandbox_process.pid, SIGKILL);
    }
    else if (reqObj.type === 'eof') {
      if (sandbox_process === null) return;
      sandbox_process.stdin.end();
    }
    else if (reqObj.type === 'input') {
      if (sandbox_process === null) return;
      const input = reqObj.content;
      sandbox_process.stdin.write(Buffer.from(input, 'utf-8'));
    }
  });
}
