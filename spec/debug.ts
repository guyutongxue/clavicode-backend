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

let started = false;

class WsTest extends EventEmitter {
  send(data: Buffer) {
    const res: WsDebugGdbS2C = JSON.parse(data.toString());
    console.log(JSON.stringify(res));
    if (res.type === 'started') {
      started = true;
    }
  }
}

const w: ws = new WsTest() as any;

function emit(req: WsDebugGdbC2S) {
  w.emit('message', Buffer.from(JSON.stringify(req)));
}

(async () => {
  debugExecution(w, path.join(__dirname, './debugTest.exe'));
  await new Promise(resolve => setTimeout(resolve, 500));
  emit({
    type: 'start'
  });
  while (!started) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  emit({
    type: 'request',
    request: '-break-insert main'
  });
  await new Promise(resolve => setTimeout(resolve, 3000));
  emit({
    type: 'request',
    request: '-exec-continue'
  });

  while (true) {}
})();
