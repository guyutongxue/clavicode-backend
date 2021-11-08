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
import cookieParser from 'cookie-parser';
import cors from 'cors';
import * as tmp from 'tmp';

import { connectToMongoDB } from './helpers/db';
import { register, login, authenticateToken, updateName, updatePassword } from './user_system';
import { languageServerHandler } from './language_server';
import { TEMP_CLANGD_TOKEN } from './constant';
import { CppCompileErrorResponse, CppCompileRequest, CppCompileResponse, CppGetHeaderFileRequest, CppGetHeaderFileResponse, UserChangePasswordRequest, UserChangeUsernameRequest, UserChangeUsernameResponse, UserLoginRequest, UserLoginResponse, UserRegisterRequest, UserRegisterResponse } from './api';
import { compileHandler } from './compile_handler';
import { findExecution, interactiveExecution } from './executions/interactive_execution';
import { getHeaderFileHandler } from './get_header_file_handler';

tmp.setGracefulCleanup();

const app = expressWs(express()).app; //创建一个expressws对象
const {
  PORT = "3000",
} = process.env;   //默认端口为3000

// app.get('/', (req: Request, res: Response) => {
//   res.send({
//     message: 'hello world',
//   });
// });

app.use(express.static('static'));
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
// app.use(
//   jwt({
//     secret: process.env.JWT_SECRET as string,
//     getToken: req => req.cookies.token,
//     algorithms:['HS256']
//   })
// );

// connect to the mongodb server; this is a async function should be awaited..
connectToMongoDB();

app.ws('/ws/execute/:token', async function (ws, req) {
  const filename = findExecution(req.params.token);
  console.log("Execute: arrived", filename);
  if (filename !== null) {
    interactiveExecution(ws, filename);
  } else {
    ws.close();
  }
});

app.ws('/ws/languageServer/clangd/:token', function (ws, req) {
  if (req.params.token === TEMP_CLANGD_TOKEN) {
    languageServerHandler(ws);
  } else {
    ws.close();
  }
});

app.post('/cpp/compile', async (req, res) => {
  try {
    const myRequest: CppCompileRequest = req.body;
    console.log(myRequest);
    const response: CppCompileResponse = await compileHandler(myRequest);
    res.json(response);
  } catch (e) {
    console.log('fail to decode request');
    console.log(e);
    res.json(<CppCompileErrorResponse>{
      status: 'error',
      errorType: 'other',
      error: 'JSON decode failure'
    });
  }
});

app.post('/cpp/getHeaderFile', (req, res) => {
  try {
    const request: CppGetHeaderFileRequest = req.body;
    const response = getHeaderFileHandler(request);
    res.json(response);
  } catch (e) {
    console.log('get file');
    res.json(<CppGetHeaderFileResponse>{
      success: false,
      reason: e,
    });
  }
});

app.post('/user/register', async (req, res) => {
  try {
    const request: UserRegisterRequest = req.body;
    const response = await register(request);
    res.json(response);
  } catch (e) {
    res.json(<UserRegisterResponse>{
      success: false,
      reason: e
    });
  }
});

app.post('/user/login', async (req, res) => {
  try {
    const request: UserLoginRequest = req.body;
    const response = await login(request);
    if (response.success) {
      res.cookie('token', response.token, { httpOnly: true });
      res.json(<UserLoginResponse>{ success: true });
    } else {
      res.json(<UserLoginResponse>{ success: false, reason: response.message });
    }
  } catch (e) {
    res.json(<UserLoginResponse>{
      success: false,
      reason: e
    });
  }
});

app.post('/user/changePassword', async (req, res) => {
  const request: UserChangePasswordRequest = req.body;
  const response = await updatePassword(request);
  res.json(response);
});

app.post('/user/changeUsername', async (req: Request, res: Response) => {
  const email = await authenticateToken(req);
  if (email === null) {
    res.json(<UserChangeUsernameResponse>{
      success: false,
      reason: 'invalid token'
    });
  } else {
    const request: UserChangeUsernameRequest = req.body;
    const response = await updateName(email, request.newUsername);
    return res.json(response);
  }
});

app.listen(PORT, () => {
  console.log('server started at http://localhost:' + PORT);
});
