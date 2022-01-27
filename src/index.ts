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

import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import { Request, Response } from 'express';
import expressWs from 'express-ws';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import * as tmp from 'tmp';
import * as path from 'path';

import { connectToMongoDB } from './db/utils';
import { verifyVeriCode, register, login, authenticateToken, updateName, updatePassword, getToken, getInfo, setCourse, remove, getVeriCode } from './user_system';
import { languageServerHandler } from './language_server';
import { UserVerifyVeriCodeResponse, UserVerifyVeriCodeRequest, UserGetVeriCodeResponse, CppCompileErrorResponse, CppCompileRequest, CppCompileResponse, CppGetHeaderFileRequest, CppGetHeaderFileResponse, OjSubmitRequest, OjSubmitResponse, UserChangePasswordRequest, UserChangeUsernameRequest, UserChangeUsernameResponse, UserLoginRequest, UserLoginResponse, UserLogoutResponse, UserRegisterRequest, UserRegisterResponse, UserGetVeriCodeRequest } from './api';
import { compileHandler } from './compile_handler';
import { getHeaderFileHandler } from './get_header_file_handler';
import { findExecution, interactiveExecution } from './executions/interactive_execution';
import { getProblem, getSolution, listProblems, listProblemSets, submitCode } from './oj/fetch';
import { debugExecution } from './debug';

tmp.setGracefulCleanup();
// need change to customize local server. 
dotenv.config({ path: path.join(__dirname, '../.env') });
const app: expressWs.Application = express() as any;
const {
  PORT = "3000",
} = process.env;

if (process.env.PRODUCTION) {
  const cert = fs.readFileSync(path.join(__dirname, '../cert/clavi.cool.pem'), 'utf-8');
  const key = fs.readFileSync(path.join(__dirname, '../cert/clavi.cool.key'), 'utf-8');

  const server = https.createServer({ key, cert }, app).listen(PORT);
  expressWs(app, server);
  
  // Redirect http on 80 port to https
  http.createServer(function (req, res) {
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
  }).listen(80);
} else {
  const server = http.createServer(app).listen(PORT, () => {
    console.log('server started at http://localhost:' + PORT);
  });
  expressWs(app, server);
}

app.use(cors({
  origin: [/localhost(:\d+)?$/, /guoyi.work$/],
  credentials: true
}));
app.use(function (req, res, next) {
  res.header("Cross-Origin-Opener-Policy", "same-origin");
  res.header("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});
app.use(express.json());
app.use(cookieParser());
app.use(express.static('static'));

// connect to the mongodb server; this is a async function should be awaited..
connectToMongoDB();

app.ws('/ws/execute/:token', async function (ws, req) {
  const filename = await findExecution(req.params.token);
  console.log("Execute: arrived", filename);
  if (filename !== null) {
    interactiveExecution(ws, filename);
  } else {
    ws.close();
  }
});

app.ws('/ws/debug/gdb/:token', async function (ws, req) {
  const filename = await findExecution(req.params.token);
  console.log("GDB: arrived", filename);
  if (filename !== null) {
    debugExecution(ws, filename);
  } else {
    ws.close();
  }
});

app.ws('/ws/languageServer/:lang', function (ws, req) {
  languageServerHandler(ws, req.params.lang);
  setTimeout(() => ws.close(), 5 * 60 * 1000);
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
    if (response.success) {
      res.cookie('token', response.token, { httpOnly: true });
      res.json(<UserLoginResponse>{ success: true });
    } else {
      res.json(<UserLoginResponse>{ success: false, reason: response.message });
    }
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
      res.cookie('token', response.token, {
        httpOnly: true,
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
      });
      res.json(<UserLoginResponse>{ success: true });
    } else {
      res.json(<UserLoginResponse>{ success: false, reason: response.message });
    }
  } catch (e) {
    if (e instanceof Error) {
      res.json(<UserLoginResponse>{
        success: false,
        reason: e.message
      });
    } else {
      res.json(<UserLoginResponse>{
        success: false,
        reason: e
      });
    }
  }
});


app.post('/user/changePassword', async (req, res) => {
  const request: UserChangePasswordRequest = req.body;
  const response = await updatePassword(request);
  res.json(response);
});

app.get('/user/logout', async (req, res) => {
  try {
    res.clearCookie('token');
    res.json({ success: true });
  } catch (e) {
    res.json(<UserLogoutResponse>{
      success: false,
      reason: e
    });
  }
});

app.get('/user/delete', async (req, res) => {
  const email = await authenticateToken(req);
  if (email) {
    try {
      res.clearCookie('token');
      const suc = await remove(email);
      res.json({ success: suc });
    } catch (e) {
      res.json({ success: false });
    }
  }
  else {
    res.json({ success: false, reason: 'email not found' });
  }
});

app.get('/user/getInfo', async (req, res) => {
  const email = await authenticateToken(req);
  if (email) {
    const ret = await getInfo(email);
    res.json(ret);

  } else {
    res.json({ success: false });
  }
});

app.post('/user/getVeriCode', async (req, res) => {
  try {
    const request: UserGetVeriCodeRequest = req.body;
    const response = await getVeriCode(request);
    res.json(response);
  } catch (e) {
    res.json(<UserGetVeriCodeResponse>{
      success: false,
      reason: e
    });
  }
});

app.post('/user/veriVeriCode', async (req, res) => {
  try {
    const request: UserVerifyVeriCodeRequest = req.body;
    const response = await verifyVeriCode(request);
    res.json(response);
  } catch (e) {
    res.json(<UserVerifyVeriCodeResponse>{
      success: false,
      reason: e
    });
  }
});


app.post('/user/authorize', async (req, res) => {
})

app.get('/user/getToken', async (req, res) => {
  const email = await authenticateToken(req);
  if (email) {
    const token = await getToken(email);
    if (email) {
      res.cookie('token', token, { httpOnly: true });
      res.json({ success: true });
    }
    res.json({ success: false });
  }
  res.json({ success: false });
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
    res.json(response);
  }
});

app.get('/oj/listProblemSets', async (req, res) => {
  const response = await listProblemSets();
  res.json(response);
});

app.get('/oj/listProblems/:problemSetId', async (req, res) => {
  const { problemSetId } = req.params;
  if (!problemSetId) {
    res.json({
      success: false,
      reason: 'no problem set id'
    });
  }
  const response = await listProblems(problemSetId);
  res.json(response);
});

app.get('/oj/getProblem/:problemSetId/:problemId', async (req, res) => {
  const { problemSetId, problemId } = req.params;
  if (!problemSetId || !problemId) {
    res.json({
      success: false,
      reason: 'no problem set id or problem id'
    });
  }
  const response = await getProblem(problemId, problemSetId);
  res.json(response);
});

app.post('/oj/submit', async (req, res) => {
  try {
    const request: OjSubmitRequest = req.body;
    const response = await submitCode(request);
    res.json(response);
  } catch {
    res.json(<OjSubmitResponse>{
      success: false,
      reason: 'JSON decode failure'
    });
  }
});

app.get('/oj/getSolution/:solutionId', async (req, res) => {
  const { solutionId } = req.params;
  if (!solutionId) {
    res.json({
      success: false,
      reason: 'no solution id'
    });
  }
  const response = await getSolution(solutionId);
  res.json(response);
});

app.post('/oj/setCourse', async (req, res) => {
  const email = await authenticateToken(req);
  console.log(email);
  if (email) {
    res.json(await setCourse(email, req.body.OJtype, req.body.courseId));
  }
  else {
    res.json({ success: false, reason: 'bad header' });
  }
});
