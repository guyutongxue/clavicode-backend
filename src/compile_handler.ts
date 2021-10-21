import * as path from 'path';
import * as fs from 'fs';
import { execFile, spawn } from 'child_process';
import { CppCompileRequest, GccDiagnostics ,CppCompileResponse} from './api';
import * as tmp from 'tmp';
import { type } from 'os';
type GenObjFileResult = {
  success:boolean,
  stderr:string,
}

type compileResult={
  status:'error'
  errorType:'compile' | 'link' | 'other';
  error: string;
}|{
  status: 'ok';
  filename:string;
}

function changeExt(srcPath: string, ext: string) {//更改后缀名为ext
  return path.join(path.dirname(srcPath), path.parse(srcPath).name + ext);
}
function getExecutablePath(srcPath: string) {//获得同路径下文件名相同的exe文件
  return path.join(path.dirname(srcPath), path.parse(srcPath).name + ".exe");
}

function execCompiler(srcPath: string, noLink: boolean, debugInfo: boolean):Promise<GenObjFileResult> {
  let outputFileName: string;
  const cwd = path.dirname(srcPath);
  let args: string[];
  if (noLink) {//如果不进行链接
    outputFileName = path.basename(changeExt(srcPath, '.o'));
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
    outputFileName = path.basename(getExecutablePath(srcPath));
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
      encoding: 'buffer',
    }, (error, _, stderrBuf) => {
      const stderr = stderrBuf.toString();
      if (error) {
        resolve({
          success: false,
          stderr:stderr,
        });
      } else {
        resolve({
          success: true,
          stderr:stderr,
        });
      }
    }
    )
  });
}
async function doCompile(code: string, debugInfo = false):Promise<compileResult> {
  console.log('Complie begin,generate .o')
  const tmpSrcFile = tmp.fileSync({
    postfix: ".cpp"
  });
  fs.writeSync(tmpSrcFile.fd, code);
  const compileResult = await execCompiler(tmpSrcFile.name, true, debugInfo);
  let diagnostics: GccDiagnostics = [];
  try {
    diagnostics = JSON.parse(compileResult.stderr);
    if(!compileResult.success){
      return {
        status:'error',
        errorType:'compile',
        error:compileResult.stderr,
        }
    }
  } catch (e) {
    tmpSrcFile.removeCallback();
    return {
      status:'error',
      errorType:'compile',
      error:compileResult.stderr,
      }
    };
  //generate .exe
  const linkResult = await execCompiler(changeExt(tmpSrcFile.name, '.o'), false, debugInfo);
  if (!linkResult.success) {
    tmpSrcFile.removeCallback();
    return {
      status:'error',
      errorType:'link',
      error:linkResult.stderr,
    };
  } else {
    fs.unlinkSync(changeExt(tmpSrcFile.name, '.o'));
    return {
      status:'ok',
      filename:'tmpSrcFile.name',
    };
  }
  
}

export function compileHandler(code:string,execute:boolean,stdin:string) {
  console.log('Receive complie request');
  const complieresult:compileResult = doCompile(code) as any;
  if(complieresult.status=='ok'){//编译成功
    if(execute){

    }
    else{
      
    }
  }
  else{

  }
}

