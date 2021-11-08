import dotenv from 'dotenv';
import { UserModel, User } from "./helpers/db";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { UserRegisterRequest, UserLoginRequest, UserChangePasswordRequest, UserChangeUsernameRequest, UserChangeUsernameResponse } from './api';

dotenv.config({ path: '../.env' });

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
    username: body.username,
    email: body.email,
    password: bcrypt.hash(body.password, 10),
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
    return { success: true };
  }
  return { success: false, reason: "user not found" };
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
