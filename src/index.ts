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
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import * as tmp from 'tmp';
import * as path from 'path';

import { connectToMongoDB } from './db/utils';
import { verifyVeriCode, register, login, authenticateToken, updateName, updatePassword, getToken, getInfo, remove, getVeriCode } from './user_system';
import { UserVerifyVeriCodeResponse, UserGetVeriCodeResponse, UserChangePasswordRequest, UserChangeUsernameRequest, UserChangeUsernameResponse, UserLoginRequest, UserLoginResponse, UserLogoutResponse, UserRegisterRequest, UserRegisterResponse, UserGetVeriCodeRequest } from './api';
import { handleOj } from './oj';
import { handleWs } from './ws';
import { handleCpp } from './cpp';

tmp.setGracefulCleanup();
// need change to customize local server. 
dotenv.config({ path: path.join(__dirname, '../.env') });
const app = express();
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
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('static'));

// connect to the mongodb server; this is a async function should be awaited..
connectToMongoDB();

handleWs(app as never);

handleCpp(app);

app.post('/user/register', async (req, res) => {
  try {
    const request: UserRegisterRequest = req.body;
    const response = await register(request);
    if (response.success) {
      res.cookie('token', response.token, { httpOnly: true });
      res.json(<UserRegisterResponse>{ success: true });
    } else {
      res.json(<UserRegisterResponse>{ success: false, reason: response.message });
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
  const username = await authenticateToken(req);
  if (username) {
    try {
      res.clearCookie('token');
      const suc = await remove(username);
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
  const username = await authenticateToken(req);
  if (username) {
    const ret = await getInfo(username);
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

app.get('/user/verify/:token', async (req, res) => {
  const { token } = req.params;
  const response = await verifyVeriCode(token);
  if (response.success)
    res.json({ success: true });
  else res.json({ success: false, reason: response.message });
});


app.post('/user/authorize', async (req, res) => {
});

app.get('/user/getToken', async (req, res) => {
  const username = await authenticateToken(req);
  if (username) {
    const token = await getToken(username);
    if (username) {
      res.cookie('token', token, { httpOnly: true });
      res.json({ success: true });
    }
    res.json({ success: false });
  }
  res.json({ success: false });
});


app.post('/user/changeNickname', async (req: Request, res: Response) => {
  const username = await authenticateToken(req);
  if (username === null) {
    res.json(<UserChangeUsernameResponse>{
      success: false,
      reason: 'invalid token'
    });
  } else {
    const request: UserChangeUsernameRequest = req.body;
    const response = await updateName({ username: username, newNickname: request.newNickname });
    res.json(response);
  }
});

handleOj(app);
