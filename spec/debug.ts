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

import { debugExecution } from "../src/debug";
import ws from "ws";
import * as path from 'path';
import EventEmitter from "events";
import { WsDebugGdbC2S, WsDebugGdbS2C } from "../src/api";

const event = new EventEmitter();

class WsTest extends EventEmitter {
  send(data: Buffer) {
    const res: WsDebugGdbS2C = JSON.parse(data.toString());
    console.log(JSON.stringify(res));
    if (res.type === 'started') {
      event.emit('started');
    } else if (res.type === 'response') {
      const r = res.response;
      if (r.type === 'notify' && r.message === 'running') {
        event.emit('run1', res);
      } else if (r.type === 'notify' && r.message === 'stopped') {
        event.emit('stop1', res);
      }
    } else if (res.type === 'tout') {
      console.log(res.content);
    }
  }
}

const w: ws = new WsTest() as any;

function emit(req: WsDebugGdbC2S) {
  w.emit('message', Buffer.from(JSON.stringify(req)));
}

(async () => {
  debugExecution(w, path.join(__dirname, './debugTest.exe'));
  await new Promise<void>(r => {
    event.once('started', r);
    emit({
      type: 'start'
    });
  });
  emit({
    type: 'request',
    request: `201-break-insert ${path.join(__dirname, './debugTest.cpp')}:5`
  });
  await new Promise<void>((r) => {
    event.once('run1', r);
    emit({
      type: 'request',
      request: '202-exec-continue'
    });
  });
  await new Promise<void>((r) => {
    event.once('stop1', r);
    emit({
      type: 'tin',
      content: '56 32\r'
    });
  });
  emit({
    type: 'request',
    request: '203-stack-list-locals --all-values'
  });
  await new Promise(resolve => setTimeout(resolve, 60000));
})();
