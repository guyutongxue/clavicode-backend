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
import path from 'path';
import ws from "ws";
import { WsExecuteC2S } from './api';
export function interactive_execution(ws: ws) {
  const sandbox_process = cp.spawn("./sandbox",
    [
      "--exe_path=../test/_chat"
    ], {
    stdio: 'pipe',
    cwd: path.join(__dirname, "sandbox/bin")
  });
  sandbox_process.stdout.on('data', (data: Buffer) => {
    console.log("Data: ", data.toString('utf-8'));
  });
  sandbox_process.stderr.on('data', (data: Buffer) => {
    console.log("Err: ", data.toString('utf-8'));
  });
  sandbox_process.stdin.write(Buffer.from("hello\n", 'utf-8'));
  sandbox_process.stdin.write(Buffer.from("bye\n", 'utf-8'));
  sandbox_process.stdin.end(); // send EOF
  sandbox_process.on('exit', () => {
    console.log("Exited");
  });
  ws.on('message', function (WsRequest: WsExecuteC2S) {
    if (WsRequest.type === 'start') {
      //
    }
    else if (WsRequest.type === 'shutdown') {
      //
    }
    else if (WsRequest.type === 'eof') {
      //
    }
    else if (WsRequest.type === 'input') {
      const input = WsRequest.content;

    }

  });
}
