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


import { UserModel, User } from "./db/utils";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as path from 'path';
import { Request, Response } from 'express';
import { UserRegisterRequest, UserLoginRequest, UserChangePasswordRequest, UserGetInfoResponse, UserChangeUsernameResponse, OjSetCourseResponse } from './api';

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
    authorized: new Map<string, string[]>(), 
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

export async function getUsername(email: string): Promise<string> {
  const user = await UserModel.findOne({email});
  if (user) {
    return user.name;
  }
  return "";
}

export async function login(body: UserLoginRequest): Promise<UserSysResponse> {
  if (!body.email || !body.password)
    return { success: false, message: 'login form incorrect' };
  const user = await UserModel.findOne({ email: body.email });
  if (!user)
    return { success: false, message: "user not found" };
  if (bcrypt.compareSync(body.password, user.password)) {
    return getToken(body.email);
  }
  return { success: false };
}

export async function getToken(email: string): Promise<UserSysResponse>{
  const token = jwt.sign({ email }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  return { success: true, token: token };
}

export async function logout(email: string): Promise<boolean>{
  const user = await UserModel.findOne({email: email});
  if (! user)
    return false;
  return true;
}

export async function remove(email: string): Promise<boolean>{
  try {
    await UserModel.findOneAndDelete({email: email});
    const user = UserModel.find({email: email});
    if(user){
      console.log(user);
      console.log('delete failed');
    }
    return true;
  }catch(e){
    return false;
  }
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

export async function getInfo(email: string): Promise<UserGetInfoResponse>{
  const user = await UserModel.findOne({email: email});
  if (user){
    return {success: true, username: user.name, authorized: user.authorized};
  }
  return {success: false};
}

export async function setCourse(email: string, OJtype: string, courseId: string): Promise<OjSetCourseResponse> {
  const user = await UserModel.findOne({email: email});
  console.log(OJtype, courseId);
  if(user){  
    try{
      if(user.authorized){
        let courses = user.authorized.get(OJtype);
        if(courses){
          courses.push(courseId);
        }else {
          courses = [courseId];
        }
        console.log(courses);
        user.authorized.set(OJtype, courses);
        await user.save();
        return {success: true};
      }
      else {
        return {success: false, reason: 'authorize undefined'};
      }
    }catch(e){
      return {success: false, reason: 'set failed'};
    }
  }
  return {success: false, reason: 'user not found'};
}
