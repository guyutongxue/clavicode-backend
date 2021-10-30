import path from "path/posix";
import { file } from "tmp";
import { CppGetHeaderFileRequest, CppGetHeaderFileResponse } from "./api";
import { readFileSync } from "fs";
export function getHeaderFileHandler(request:CppGetHeaderFileRequest):CppGetHeaderFileResponse{
  const filename=request.path;
  const header='/user/include';
  if(filename.search(header)!==-1){
    const content=readFileSync(filename,'utf-8');
    return {
      success:true,
      content:content,
    };
  }
  return {
    success:false,
    reason:'illegal path',
  };
}
