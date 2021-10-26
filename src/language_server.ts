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

import * as rpc from "@codingame/monaco-jsonrpc";
import * as server from "@codingame/monaco-jsonrpc/lib/server";
import * as lsp from "vscode-languageserver";
import ws from "ws";
import * as cp from "child_process";

const EXEC_PATH = "clangd";
const ARGS = [
  "--query-driver=/usr/bin/g++-11"
];

// https://github.com/CodinGame/monaco-jsonrpc/blob/master/src/server/launch.ts
// Modified, make stderr silent.
function createServerProcess(serverName: string, command: string, args: string[], options: cp.SpawnOptions): server.IConnection {
  const serverProcess = cp.spawn(command, args, options);
  serverProcess.on('error', error =>
    console.error(`Launching ${serverName} Server failed: ${error}`)
  );
  serverProcess.stderr!.on('data', data => {
    // console.error(`${serverName} Server: ${data}`)
  });
  return server.createProcessStreamConnection(serverProcess);
}


function launch(socket: rpc.IWebSocket, serverPath: string, env: NodeJS.ProcessEnv, args: string[]) {
  const reader = new rpc.WebSocketMessageReader(socket);
  const writer = new rpc.WebSocketMessageWriter(socket);
  const socketConnection = server.createConnection(reader, writer, () => socket.dispose());
  const serverConnection = createServerProcess('C++', serverPath, args, {
    env,
  });
  server.forward(socketConnection, serverConnection, message => {
    if (rpc.isRequestMessage(message)) {
      if (message.method === lsp.InitializeRequest.type.method) {
        const initializeParams = message.params as lsp.InitializeParams;
        initializeParams.processId = process.pid;
      }
    }
    return message;
  });
}

export function languageServerHandler(ws: ws) {
  const socket: rpc.IWebSocket = {
    send: (data) => ws.send(data, (err) => {
      if (err) throw err;
    }),
    onMessage: (callback) => ws.on('message', callback),
    onError: (callback) => ws.on('error', callback),
    onClose: (callback) => ws.on('close', callback),
    dispose: () => ws.close()
  };
  if (ws.readyState == ws.OPEN) {
    launch(socket, EXEC_PATH, { PATH: process.env.PATH }, ARGS);
  } else {
    ws.on('open', () => launch(socket, EXEC_PATH, { PATH: process.env.PATH }, ARGS));
  }
}
