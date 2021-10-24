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

import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { CppCompileRequest, CppCompileResponse, GccDiagnostics, } from './api';
import * as tmp from 'tmp';
import { fileExecution } from './file_execution';

type ExecCompilerResult = {
  success: boolean;
  stderr: string;
}

type BuildResult = {
  success: false;
  errorType: 'compile' | 'link' | 'other';
  error: string;
} | {
  success: false;
  errorType: 'compile';
  error: GccDiagnostics;
} | {
  success: true;
  error: GccDiagnostics;
  filename: string;
}

/**
 * 更改后缀名为 ext
 * @param srcPath 
 * @param ext 
 * @returns 
 */
function changeExt(srcPath: string, ext: string) {
  return path.join(path.dirname(srcPath), path.parse(srcPath).name + ext);
}

/**
 * 获得同路径下文件名相同的exe文件
 * @param srcPath 
 * @returns 
 */
function getExecutablePath(srcPath: string) {
  return path.join(path.dirname(srcPath), path.parse(srcPath).name + ".exe");
}

function execCompiler(srcPath: string, noLink: boolean, debugInfo: boolean): Promise<ExecCompilerResult> {
  let outputFileName: string;
  const cwd = path.dirname(srcPath);
  srcPath = path.basename(srcPath);
  let args: string[];
  if (noLink) {// 如果不进行链接
    outputFileName = changeExt(srcPath, '.o');
    args = [
      //...store.get('build.compileArgs').map(parseDynamic),
      ...(debugInfo ? ['-g'] : []),
      '-c',
      srcPath,
      '-o',
      outputFileName,
      '-fdiagnostics-format=json',
    ];
  } else {
    outputFileName = getExecutablePath(srcPath);
    args = [
      //...store.get('build.compileArgs').map(parseDynamic),
      srcPath,
      '-o',
      outputFileName,
    ];
  }
  return new Promise((resolve) => {
    execFile('g++', args, {
      cwd: cwd,
    }, (error, _, stderr) => {
      if (error) {
        resolve({
          success: false,
          stderr: stderr,
        });
      } else {
        resolve({
          success: true,
          stderr: stderr,
        });
      }
    }
    );
  });
}

async function doBuild(code: string, debugInfo = false): Promise<BuildResult> {
  console.log('Compile begin, generate .o');
  // generate .cpp
  const tmpSrcFile = tmp.fileSync({
    postfix: ".cpp"
  });
  fs.writeSync(tmpSrcFile.fd, code);

  // generate .o
  const compileResult = await execCompiler(tmpSrcFile.name, true, debugInfo);
  tmpSrcFile.removeCallback();

  let diagnostics: GccDiagnostics;
  try {
    diagnostics = JSON.parse(compileResult.stderr);
  } catch (e) {
    console.log(e);
    console.log('fail to parse compile result stderr');
    return {
      success: false,
      errorType: 'other',
      error: compileResult.stderr,
    };
  }
  if (!compileResult.success) {
    return {
      success: false,
      errorType: 'compile',
      error: diagnostics,
    };
  }

  // generate .exe
  const linkResult = await execCompiler(changeExt(tmpSrcFile.name, '.o'), false, debugInfo);
  fs.unlinkSync(changeExt(tmpSrcFile.name, '.o'));
  if (!linkResult.success) {
    return {
      success: false,
      errorType: 'link',
      error: linkResult.stderr,
    };
  } else {
    return {
      success: true,
      error: diagnostics,
      filename: getExecutablePath(tmpSrcFile.name),
    };
  }

}

export async function compileHandler(request: CppCompileRequest): Promise<CppCompileResponse> {
  console.log('Receive compile request');
  const compileResult = await doBuild(request.code, request.execute === 'debug');
  if (!compileResult.success) {//编译成功
    return {
      status: 'error',
      errorType: compileResult.errorType,
      error: compileResult.error
    };
  }
  switch (request.execute) {
    case 'none': {
      return {
        status: 'ok',
        execute: request.execute
      };
    }
    case 'file': {
      const stdin = request.stdin ?? "";
      fileExecution(compileResult.filename, stdin);
      return {
        status: 'error',
        errorType: 'other',
        error: 'not implemented'
      };
    }
    case 'debug':
    case 'interactive':
      return {
        status: 'error',
        errorType: 'other',
        error: 'not implemented'
      };
    default: {
      const _: never = request.execute;
      return {
        status: 'error',
        errorType: 'other',
        error: 'unknown execute type',
      };
    }
  }
}

