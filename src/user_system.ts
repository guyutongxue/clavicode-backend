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

import dotenv from 'dotenv';
import { UserModel, User } from "./db/utils";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { UserRegisterRequest, UserLoginRequest, UserChangePasswordRequest, UserChangeUsernameRequest, UserChangeUsernameResponse } from './api';
// need change to customize local server. 
dotenv.config({ path: '/home/glg2021/workspace/clavicode-backend/.env' });

export type UserSysResponse = {
  success: boolean;
  token?: string;
  message?: string;
}

export async function register(body: UserRegisterRequest): Promise<UserSysResponse> {
  if (!body.email || !body.password || !body.username) {
    return { success: false, message: 'register form incorrect' };
  }
  if (await UserModel.findOne({ email: body.email })) {
    return { success: false, message: "Email Address" + body.email + "is already taken" };
  }
  const user = new UserModel({
    name: body.username,
    email: body.email,
    password: await bcrypt.hash(body.password, 10),
    is_authorized: false,
  });
  await user.save();
  return { success: true };
}

export async function updatePassword(body: UserChangePasswordRequest): Promise<UserSysResponse> {
  const user = await UserModel.findOne({ email: body.email });
  if (user) {
    if (bcrypt.compareSync(body.oldPassword, user.password)) {
      user.password = bcrypt.hashSync(body.newPassword, 10);
      user.markModified('password');
      await user.save();
      return { success: true };
    }
    return { success: false, message: "incorrect password" };
  }
  return { success: false, message: "user not found" };
}


export async function updateName(email: string, username: string): Promise<UserChangeUsernameResponse> {
  const user = await UserModel.findOne({ email });
  if (user) {
    user.name = username;
    user.markModified('name');
    await user.save();
    return { success: true };
  }
  return { success: false, reason: "user not found" };
}

export async function getUserInfo(email: string): Promise<void> {

}

export async function login(body: UserLoginRequest): Promise<UserSysResponse> {
  if (!body.email || !body.password)
    return { success: false, message: 'login form incorrect' };
  const user = await UserModel.findOne({ email: body.email });
  if (!user)
    return { success: false, message: "user not found" };
  if (bcrypt.compareSync(body.password, user.password)) {
    const token = jwt.sign({ email: body.email }, process.env.JWT_SECRET as string, { expiresIn: '1d' });
    return { success: true, token: token };
  }
  return { success: false };
}

export async function authenticateToken(req: Request): Promise<string | null> {
  const token: string | undefined = req.cookies.token;
  if (!token) return null;
  return new Promise<string | null>((resolve) => {
    jwt.verify(token, process.env.JWT_SECRET as string, (err, decoded) => {
      if (err || !decoded) resolve(null);
      else resolve(decoded.email);
    });
  });
}
