
import { CppGetHeaderFileRequest, CppGetHeaderFileResponse } from "./api";
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
