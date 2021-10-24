import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { GccDiagnostics, } from './api';
import * as tmp from 'tmp';

type ExecCompilerResult = {
  success: boolean;
  stderr: string;
}
type BuildResult = {
  success: false;
  errorType: 'compile' | 'link' | 'other';
  error: string | GccDiagnostics;
} | {
  success: true;
  filename: string;
}
export type CompileOrExecute = {
  success: false;
  errorType: 'compile' | 'link' | 'other';
  error: string | GccDiagnostics;
} | {
  success: true;
  stdout: string;
  stderr: string;
  result: string;
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
  const tmpSrcFile = tmp.fileSync({
    postfix: ".cpp"
  });
  fs.writeSync(tmpSrcFile.fd, code);
  const compileResult = await execCompiler(tmpSrcFile.name, true, debugInfo);
  tmpSrcFile.removeCallback();
  try {
    const diagnostics: GccDiagnostics = JSON.parse(compileResult.stderr);
    if (!compileResult.success) {
      return {
        success: false,
        errorType: 'compile',
        error: diagnostics,
      };
    }
  } catch (e) {
    console.log(e);
    console.log('fail to parse compile reasult stderror');
    return {
      success: false,
      errorType: 'compile',
      error: compileResult.stderr,
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
      filename: getExecutablePath(tmpSrcFile.name),
    };
  }

}

export async function compileHandler(code: string, execute: boolean, stdin: string | undefined): Promise<CompileOrExecute> {
  console.log('Receive compile request');
  const compileResult = await doBuild(code);
  if (compileResult.success) {//编译成功
    if (execute) {
      const tmpStdinFile = tmp.fileSync({
        postfix: ".txt"
      });
      if (stdin) {
        fs.writeFileSync(tmpStdinFile.fd, stdin);
      }
      const tmpStderrFile = tmp.fileSync({
        postfix: ".txt"
      });
      const tmpStdoutFile = tmp.fileSync({
        postfix: ".txt"
      });
      const tmpResultFile = tmp.fileSync({
        postfix: ".txt"
      });
      execFile('./sandbox/bin/sandbox', [
        `--exe_path=${compileResult.filename}`,
        '--max_real_time=1000',
        `--input_path=${tmpStdinFile}`,
        `--output_path=${tmpStdoutFile}`,
        `--error_path=${tmpStderrFile}`,
        `result_path=${tmpResultFile}`],
        (error) => {
          if (error) {
            console.log('fail to execute');
            return {
              success: false,
              errorType: 'execute',
              error: error,
            };
          }
          else {//成功执行文件
            const stdout = fs.readFileSync(tmpStdoutFile.name);
            const stderr = fs.readFileSync(tmpStderrFile.name);
            const result = fs.readFileSync(tmpResultFile.name);
            tmpStdoutFile.removeCallback();
            tmpStderrFile.removeCallback();
            tmpResultFile.removeCallback();
            return {
              success: true,
              stdout: stdout,
              stderr: stderr,
              result: result,
            };
          }
        });
    }
    else {//目前不支持只编译不运行
      console.log('none api');
      return {
        success: false,
        errorType: 'other',
        error: 'none api',
      };
    }
  }
  else {//编译失败
    return compileResult;
  }
  return {
    success: false,
    errorType: 'other',
    error: 'missing',
  };
}

