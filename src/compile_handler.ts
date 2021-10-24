import * as path from 'path';
import * as fs from 'fs';
import { execFile, spawn } from 'child_process';
import { CppCompileRequest, GccDiagnostics, CppCompileResponse } from './api';
import * as tmp from 'tmp';
type ExecCompilerResult = {
  success: boolean,
  stderr: string,
}

type CompileResult = {
  success: false;
  errorType: 'compile' | 'link' | 'other';
  error: string;
} | {
  success: true;
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
    )
  });
}
async function doCompile(code: string, debugInfo = false): Promise<CompileResult> {
  console.log('Compile begin, generate .o')
  const tmpSrcFile = tmp.fileSync({
    postfix: ".cpp"
  });
  fs.writeSync(tmpSrcFile.fd, code);
  const execResult = await execCompiler(tmpSrcFile.name, true, debugInfo);
  tmpSrcFile.removeCallback();
  let diagnostics: GccDiagnostics = [];
  try {
    diagnostics = JSON.parse(execResult.stderr);
    if (!execResult.success) {
      return {
        success: false,
        errorType: 'compile',
        error: execResult.stderr,
      }
    }
  } catch (e) {
    return {
      success: false,
      errorType: 'compile',
      error: execResult.stderr,
    }
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
      filename: tmpSrcFile.name,
    };
  }

}

export async function compileHandler(code: string, execute: boolean, stdin: string) {
  console.log('Receive compile request');
  const compileResult = await doCompile(code);
  if (compileResult.success) {//编译成功
    if (execute) {
    }
    else {

    }
  }
  else {

  }
}

