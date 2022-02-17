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


import { UserModel, VeriCodeModel } from "./db/utils";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { UserUpdateNameRequest, UserRegisterRequest, UserLoginRequest, UserChangePasswordRequest, UserGetInfoResponse, UserChangeUsernameResponse, OjSetCourseResponse, UserGetVeriCodeResponse } from './api';
import nodemailer from 'nodemailer';
import smtpTransport from 'nodemailer-smtp-transport';
import { BACKEND_HOST } from "./index";

const regEmail = /^([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)([a-zA-Z]+)$/;

const pkuEmail = /^([a-zA-Z0-9]+[_|-|.]?)*[a-zA-Z0-9]+@(stu\.)?pku\.edu\.cn$/;
// one a-z one 0-9 length >= 6
const regPassword = /^(?=.*?[a-z])(?=.*?[0-9]).{6,}$/;

export type UserSysResponse = {
  success: boolean;
  token?: string;
  message?: string;
  username?: string;
  password?: string;
}

export async function register(body: UserRegisterRequest): Promise<UserSysResponse> {
  if (!body.password || !body.username) {
    return { success: false, message: 'register form incorrect' };
  }
  if (await UserModel.findOne({ username: body.username })) {
    return { success: false, message: "username is taken." };
  }
  if (!regPassword.test(body.password)) {
    return { success: false, message: "fail password requirement: at least one a-z one 0-9 length >= 6" };
  }

  const user = new UserModel({
    username: body.username,
    password: await bcrypt.hash(body.password, 10),
    isVIP: false,
    authorized: new Map<string, string[]>(),
  });
  await user.save();
  return { success: true };
}

export async function verifyVeriCode(token: string): Promise<UserSysResponse> {
  try {
    interface TokenIF {
      username: string;
      email: string;
    }
    const decoded_token = jwt.verify(token, process.env.JWT_SECRET as string) as TokenIF;
    console.log(decoded_token);
    const veriCode = await VeriCodeModel.findOne({ email: decoded_token.email });
    if (veriCode) {
      const user = await UserModel.findOne({ username: decoded_token.username });
      if (user) {
        user.email = veriCode.email;
        if (pkuEmail.test(veriCode.email)) {
          user.isVIP = true;
          user.markModified("isVIP");
        }
        else {
          user.isVIP = false;
        }
        user.markModified("email");
        user.save();
        VeriCodeModel.deleteMany({ email: decoded_token.email });
        return { success: true };
      }
      else return { success: false, message: "token err" };
    }
    return { success: false, message: "email not found" };

  } catch (e) {
    return { success: false, message: "token err" };
  }
}




export async function verifyChangePassword(token: string): Promise<UserSysResponse> {
  interface TokenIF {
    email: string;
    password: string;
  }
  const decoded_token = jwt.verify(token, process.env.JWT_SECRET as string) as TokenIF;
  const user = await UserModel.findOne({ email: decoded_token.email });
  if (user) {
    user.password = bcrypt.hashSync(decoded_token.password, 10);
    user.markModified('password');
    await user.save();
    return { success: true, password: decoded_token.password, username: user.username };
  }
  return { success: false };
}
export async function searchUser(username: string, email: string): Promise<UserSysResponse> {
  console.log(username, email);
  try {
    const user = await UserModel.findOne({ $or: [{ username: username }, { email: email }] });
    if (user) {
      return { success: true };
    }
    return { success: false };
  }
  catch (e) {
    return { success: false };
  }
}

export async function forgetPassword(email: string): Promise<UserSysResponse> {
  console.log(email);
  const user = await UserModel.findOne({ email: email });
  if (!user)
    return { success: false, message: "email not found" };
  const randomPassword = () => {
    let code = Math.random().toString(36).slice(-8);
    while (!regPassword.test(code))
      code = Math.random().toString(36).slice(-8);
    return code;
  };
  const newPassword = randomPassword();
  const jwtToken = jwt.sign({ email: email, password: newPassword }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  const transport = nodemailer.createTransport(smtpTransport({
    host: 'smtp.163.com', // 服务
    port: 465, // smtp端口
    secure: true,
    auth: {
      user: 'clavicode@163.com', //用户名
      pass: process.env.SMTP_PASSWORD // SMTP授权码
    }
  }));
  const err = await new Promise<Error | null>((resolve) => {
    transport.sendMail({
      from: "clavicode@163.com",
      to: email,
      subject: "Clavicode: find back password",
      html: `
            <p>Dear ${user.username}: </p>
            <p>This is the password reset email from clavicode.</p>
            <a href="${BACKEND_HOST}/user/verifyChangePassword/${jwtToken}">  Click this link to confirm the change.</a>
      `
    }, resolve);
    console.log("changePasswordVeriAddress: ", `${BACKEND_HOST}/user/verifyChangePassword/${jwtToken}`);
  });
  if (err !== null) {
    return { success: false, message: 'send email error: ' + err.message };
  }
  return { success: true };
}

export async function sendFeedback(msg: string): Promise<UserSysResponse>{
  const transport = nodemailer.createTransport(smtpTransport({
    host: 'smtp.163.com', // 服务
    port: 465, // smtp端口
    secure: true,
    auth: {
      user: 'clavicode@163.com', //用户名
      pass: process.env.SMTP_PASSWORD // SMTP授权码
    }
  }));
  const err = await new Promise<Error | null>((resolve) => {
    transport.sendMail({
      from: "clavicode@163.com",
      to: "clavicode@163.com",
      subject: "Feedback",
      html: `
            <p>${msg}</p>
      `
    }, resolve);
  });
  if (err !== null){
    return {success: false, message: 'send email error: ' + err.message};
  }
  return {success: true};
}


// send the verification code to the given email addr
export async function getVeriCode(username: string, email: string): Promise<UserGetVeriCodeResponse> {
  if (!email) {
    return { success: false, reason: 'register form incorrect' };
  }
  if (await UserModel.findOne({ email: email })) {
    return { success: false, reason: "The email is already taken." };
  }
  if (!regEmail.test(email)) {
    return { success: false, reason: "Email format error" };
  }
  const transport = nodemailer.createTransport(smtpTransport({
    host: 'smtp.163.com', // 服务
    port: 465, // smtp端口
    secure: true,
    auth: {
      user: 'clavicode@163.com', //用户名
      pass: process.env.SMTP_PASSWORD // SMTP授权码
    }
  }));

  // const code = generateVeriCode();
  const jwtToken = jwt.sign({ email: email, username: username }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  const err = await new Promise<Error | null>((resolve) => {
    transport.sendMail({
      from: 'clavicode@163.com',
      to: email,
      subject: 'Clavicode: verify your email', // 标题
      html: `
            <p>Welcome to the clavicode community!</p>
            <p>This is the verification email.</p>
            <a href="${BACKEND_HOST}/user/verify/${jwtToken}"> Click here to verify your email.</a>
            <p>***Please verify in five minutes.***</p>` // html 内容
    }, resolve);
  });
  if (err !== null)
    return { success: false, reason: 'send email error' };
  VeriCodeModel.deleteMany({ email: email }); // delete previous record
  if (!await VeriCodeModel.insertMany({ email: email }))
    return { success: false, reason: "database error" };
  return { success: true };
}

export async function updatePassword(body: UserChangePasswordRequest): Promise<UserSysResponse> {
  const user = await UserModel.findOne({ username: body.username });
  if (user) {
    if (bcrypt.compareSync(body.oldPassword, user.password)) {
      if (!regPassword.test(body.newPassword)) {
        return { success: false, message: "Password format incorrect: one letter, one number, length >= 6" };
      }
      user.password = bcrypt.hashSync(body.newPassword, 10);
      user.markModified('password');
      await user.save();
      return { success: true };
    }
    return { success: false, message: "old password incorrect" };
  }
  return { success: false, message: "please register again" };
}


export async function login(body: UserLoginRequest): Promise<UserSysResponse> {
  if (!body.username || !body.password)
    return { success: false, message: 'login form incorrect' };
  const user = await UserModel.findOne({ username: body.username });
  if (!user)
    return { success: false, message: "user not found" };
  if (bcrypt.compareSync(body.password, user.password)) {
    return getToken(body.username);
  }
  return { success: false };
}

export async function getToken(username: string): Promise<UserSysResponse> {
  const token = jwt.sign({ username }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  return { success: true, token: token };
}

export async function logout(username: string): Promise<UserSysResponse> {
  const user = await UserModel.findOne({ username: username });
  if (!user)
    return { success: false };
  return { success: true };
}

export async function remove(email: string): Promise<boolean> {
  try {
    await UserModel.findOneAndDelete({ email: email });
    const user = UserModel.find({ email: email });
    if (user) {
      console.log(user);
      console.log('delete failed');
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function authenticateToken(req: Request): Promise<string | null> {
  const token: string | undefined = req.cookies.token;
  if (!token) return null;
  return new Promise<string | null>((resolve) => {
    jwt.verify(token, process.env.JWT_SECRET as string, (err, decoded) => {
      if (err || !decoded) resolve(null);
      else resolve(decoded.username);
    });
  });
}

export async function getInfo(username: string): Promise<UserGetInfoResponse> {
  const user = await UserModel.findOne({ username: username });
  if (user) {
    return { success: true, email: user.email, username: user.username, isVIP: user.isVIP, authorized: user.authorized };
  }
  return { success: false };
}

export async function setCourse(username: string, OJtype: string, courseId: string): Promise<OjSetCourseResponse> {
  const user = await UserModel.findOne({ username: username });
  console.log(OJtype, courseId);
  if (user) {
    try {
      if (user.authorized) {
        let courses = user.authorized.get(OJtype);
        if (courses) {
          courses.push(courseId);
        } else {
          courses = [courseId];
        }
        console.log(courses);
        user.authorized.set(OJtype, courses);
        await user.save();
        return { success: true };
      }
      else {
        return { success: false, reason: 'authorize undefined' };
      }
    } catch (e) {
      return { success: false, reason: 'set failed' };
    }
  }
  return { success: false, reason: 'user not found' };
}
