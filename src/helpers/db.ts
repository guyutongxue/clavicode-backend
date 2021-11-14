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
import { Schema, model, Document, connect } from "mongoose";
export interface User {
  name: string;
  email: string;
  password: string;
  is_authorized?: boolean;
  course?: { [key: string]: string };
}

export interface File {
  id: string;
  path: string;
  timeoutId: number;
  createdAt: Date;
}

const userSchema = new Schema<User>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  is_authorized: { type: Boolean, default: false },
  course: {
    type: Map,
    of: String
  }
});

const fileSchema = new Schema<File>({
  id: { type: String, required: true },
  path: { type: String, required: true },
  timeoutId: { type: Number, required: true },
  createdAt: { type: Date, expires: 60 }
});

export const UserModel = model<User>('User', userSchema);
export const FileModel = model<File>('File', fileSchema);

// run().catch(err=>console.log(err));

export async function connectToMongoDB(): Promise<void> {
  await connect('mongodb://localhost:27017/').then(() => {
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
