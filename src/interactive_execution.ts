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
import { TEMP_EXECUTE_TOKEN } from './constant';
export function findExecution(token:string):string{
  if(token===TEMP_EXECUTE_TOKEN){
    return "../test/_chat";
  }else return "None";
}
export function interactive_execution(ws: ws,filename:string) {
  ws.on('message', function (WsRequest: WsExecuteC2S) {
  let sandbox_process:cp.ChildProcessWithoutNullStreams=cp.spawn('sleep',['--version']);
    if (WsRequest.type === 'start') {
      sandbox_process = cp.spawn("./sandbox",
        [
          `--exe_path=${filename}`
        ], {
        stdio: 'pipe',
        cwd: path.join(__dirname, "sandbox/bin")
      });
    }
    else if (WsRequest.type === 'shutdown') {
      sandbox_process.on('exit', () => {
        console.log("Exited");
      });
    }
    else if (WsRequest.type === 'eof') {
      sandbox_process.stdin.end(); // send EOF
    }
    else if (WsRequest.type === 'input') {
      const input = WsRequest.content;
      sandbox_process.stdin.write(Buffer.from(input, 'utf-8'));
      sandbox_process.stdout.on('data', (data: Buffer) => {
        console.log("Data: ", data.toString('utf-8'));
        //still need to handle
      });
      sandbox_process.stderr.on('data', (data: Buffer) => {
        console.log("Err: ", data.toString('utf-8'));
        //still need to handle
      });
    }

  });
}
