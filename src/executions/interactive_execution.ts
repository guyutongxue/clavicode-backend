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

import ws from "ws";
import { WsExecuteC2S, WsExecuteS2C } from '../api';
import * as pty from "node-pty";
import { query } from '../file_DB';
import * as tmp from 'tmp';
import * as fs from 'fs';
import { SandboxResult } from './file_execution';
import { constants } from 'os';

export function findExecution(id: string): Promise<string | null> {
  return query(id);
}
export function interactiveExecution(ws: ws, filename: string) {

  const tmpResultFile = tmp.fileSync({
    postfix: ".json"
  });
  let ptyProcess: null | pty.IPty = null;

  function send(data: WsExecuteS2C) {
    console.log("sent: ", data);
    ws.send(Buffer.from(JSON.stringify(data)));
  }

  function close() {
    tmpResultFile.removeCallback();
    if (ptyProcess !== null) {
      ptyProcess.kill();
    }
    fs.unlinkSync(filename);
    ws.close();
    console.log("closed");
  }

  ws.on('message', function (req: Buffer) {
    const reqObj: WsExecuteC2S = JSON.parse(req.toString());
    console.log("request: ", reqObj);
    if (reqObj.type === 'start') {
      ptyProcess = pty.spawn('../sandbox/bin/sandbox', [
        `--exe_path=${filename}`,
        '--max_real_time=300000',
        `--result_path=${tmpResultFile.name}`,
        `--log_path=/dev/null`
      ], {
        cwd: __dirname,
        env: process.env as { [key: string]: string },
      });
      if (ptyProcess === null) {
        send({ type: 'error', reason: 'system' });
        return;
      }
      send({ type: 'started' });
      ptyProcess.onData(function (data) {
        send({ type: 'tout', content: data });
      });
      ptyProcess.onExit(function (data) {
        if (ws.readyState === ws.CLOSED) return;
        if (data.exitCode !== 0) {
          send({ type: 'error', reason: 'system' });
          console.log('交互式运行时，沙箱未正常退出');
          return;
        }
        const str = fs.readFileSync(tmpResultFile.name, 'utf-8');
        console.log("result: ", str);
        const result: SandboxResult = JSON.parse(str);
        tmpResultFile.removeCallback();
        if (result.exit_code !== 0) {
          send({ type: 'error', reason: 'system' });
          return;
        }
        if (result.result === 0) {
          // SUCCESS
          send({
            type: 'closed',
            exitCode: 0
          });
        } else if (result.result === 1 || result.result === 2) {
          // CPU_TIME_LIMIT_EXCEEDED, REAL_TIME_LIMIT_EXCEEDED,
          send({
            type: 'error',
            reason: 'timeout',
          });
        } else if (result.result === 3) {
          // MEMORY_LIMIT_EXCEEDED
          send({
            type: 'error',
            reason: 'memout',
          });
        } else if (result.result === 4) {
          // RUNTIME_ERROR
          send({
            type: 'error',
            reason: result.signal === constants.signals.SIGSYS ? 'violate' : 'other',
          });
        } else {
          send({
            type: 'error',
            reason: 'system',
          });
          console.log("UNKNOWN RESULT TYPE");
        }
        return;
      });
    } else if (reqObj.type === 'shutdown') {
      close();
    } else if (reqObj.type === 'eof') {
      if (ptyProcess === null) {
        send({ type: 'error', reason: 'system' });
        console.log("NOT STARTED");
        return;
      }
      ptyProcess.write('\x04');

    } else if (reqObj.type === 'tin') {
      if (ptyProcess === null) {
        send({ type: 'error', reason: 'system' });
        console.log("NOT STARTED");
        return;
      }

      const input = reqObj.content;
      ptyProcess.write(input);
    }
  });

  ws.on('close', function() {
    close();
  });
}
