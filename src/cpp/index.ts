// Copyright (C) 2022 Clavicode Team
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

import type { Application } from "express";
import type { CppCompileErrorResponse, CppCompileRequest, CppCompileResponse, CppGetHeaderFileRequest, CppGetHeaderFileResponse } from "../api";
import { getHeaderFileHandler } from "./get_header_file_handler";
import { compileHandler } from "./compile";

export function handleCpp(app: Application) {

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

}
