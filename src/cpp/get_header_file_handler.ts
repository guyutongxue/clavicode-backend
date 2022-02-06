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


import type { CppGetHeaderFileRequest, CppGetHeaderFileResponse } from "../api";
import { readFileSync } from "fs";

const GCC_ARCHITECTURE = "x86_64-linux-gnu";
const GCC_VERSION = "11";

const GCC_SEARCH_DIRS = [
  // `/usr/include/c++/${GCC_VERSION}`,
  // `/usr/include/${GCC_ARCHITECTURE}/c++/${GCC_VERSION}`,
  // `/usr/include/c++/${GCC_VERSION}/backward`,
  `/usr/lib/gcc/${GCC_ARCHITECTURE}/${GCC_VERSION}/include`,
  // `/usr/local/include`,
  // `/usr/include/${GCC_ARCHITECTURE}`,
  `/usr/include`
];

export function getHeaderFileHandler(request: CppGetHeaderFileRequest): CppGetHeaderFileResponse {
  const filepath = request.path;
  if (GCC_SEARCH_DIRS.findIndex(dir => filepath.startsWith(dir)) !== -1) {
    const content = readFileSync(filepath, 'utf-8');
    return {
      success: true,
      content: content,
    };
  } else {
    return {
      success: false,
      reason: 'illegal path',
    };
  }
}
