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

import express from 'express';
import { Request, Response } from 'express';
import expressWs from 'express-ws';
import { languageServerHandler } from './language_server';
import { f } from './sandbox_interface';
import { TEMP_CLANGD_TOKEN } from './constant';
import { CppCompileRequest } from './api';

// f();

const app = expressWs(express()).app; //创建一个expressws对象
const {
  PORT = "3000",
} = process.env;   //默认端口为3000

// app.get('/', (req: Request, res: Response) => {
//   res.send({
//     message: 'hello world',
//   });
// });

app.use(express.static('test'));

app.ws('/socketTest', function (ws, req) {
  ws.send(`{"message": "hello"}`);
  ws.on('message', function (msg) {
    const str = msg.toString();
    ws.send(`{"message": "received ${str.length} bytes"}`);
  });
  ws.on('close', function () {
    console.log('closed');
  })
})
app.ws('/ws/languageServer/clangd/:token', function (ws, req) {
  if (req.params.token === TEMP_CLANGD_TOKEN) {
    languageServerHandler(ws);
  } else {
    ws.close();
  }
});

app.post('/cpp/complie', function (req: Request, res: Response) {
  try {
    const myRequest: CppCompileRequest = req.body;
    console.log(myRequest);
    if (myRequest.execute == 'none') {//仅编译，不运行

    } else if (myRequest.execute == 'file') {//直接运行

    } else if (myRequest.execute == 'interactive') {//交互式

    } else if (myRequest.execute == 'debug') {//调试

    } else {
      console.log('bad request of `execute` params');
    }
  }catch(e){
    console.log('fail to decode request');
    console.log(e);
  }
  

})
app.listen(PORT, () => {
  console.log('server started at http://localhost:' + PORT);
});
