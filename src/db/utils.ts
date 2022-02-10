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

// the mongodb connection
import { Schema, model, connect } from "mongoose";
export interface User {
  username: string;
  password: string;
  email?: string;
  isVIP: boolean;
  authorized?: Map<string, string[]>;
}

export interface File {
  id: string;
  path: string;
  timeoutId: number;
  createdAt: Date;
}

export interface VeriCode {
  email: string;
  expire_at?: Date;
}

const userSchema = new Schema<User>({
  username: {type: String, required: true},
  password: { type: String, required: true },
  email: { type: String, default: "" },
  isVIP: { type: Boolean, default: false},
  authorized: {
    type: Map, 
    of: [String], 
  } 
});

const fileSchema = new Schema<File>({
  id: { type: String, required: true },
  path: { type: String, required: true },
  timeoutId: { type: Number, required: true },
  createdAt: { type: Date, expires: 60 }
});


const veriCodeSchema = new Schema<VeriCode>({
  email: {type: String, required: true},
  expire_at: {type: Date, default: Date.now, expires: 300}
});


export const UserModel = model<User>('User', userSchema);
export const FileModel = model<File>('File', fileSchema);
export const VeriCodeModel = model<VeriCode>('VeriCode', veriCodeSchema);

// run().catch(err=>console.log(err));

export async function connectToMongoDB(): Promise<void> {
  await connect('mongodb://localhost:27017/clavicode').then(() => {
    console.log('connected to server');
  });
  // const doc = new UserModel({
  //     name: "Chen",
  //     email: "Chen@gmail.com",
  //     password: "Happy",
  // });
  // await doc.save();
  // console.log(doc.email);
}
