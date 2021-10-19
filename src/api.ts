
type CppCompileRequest = {
  code: string;
  execute: boolean;
};
type CppCompileResponse = {
  status: 'error' | 'ok';
  error?: GccDiagnostics; // If status is 'error'
  executeToken?: string;  // If status is 'ok' and `execute` in request is true
};

type CppDebugRequest = {
  code: string
};
type CppDebugResponse = {
  status: 'error' | 'ok';
  error?: GccDiagnostics; // If status is 'error'
  debugToken?: string;    // If status is 'ok' 
}

type CppDownloadRequest = {
  code: string;
  platform: 'mingw' | 'linux' | 'darwin';
};
type CppDownloadResponse = {
  downloadLink: string;
  expireDate: string;
};

type WsExecuteC2S = {
  type: 'start';
} | {
  type: 'shutdown';
} | {
  type: 'eof';
} | {
  type: 'input';
  content: string;
};
type WsExecuteS2C = {
  type: 'started';
} | {
  type: 'closed';
  retVal: number;
} | {
  type: 'timeout';
} | {
  type: 'output';
  content: string;
}

type WsDebugGdbC2S = {
  type: 'start';
} | {
  type: 'request';
  request: string;
} | {
  type: 'shutdown';
};
type WsDebugGdbS2C = {
  type: 'started';
} | {
  type: 'closed';
  retVal: number;
} | {
  type: 'timeout';
} | {
  type: 'response';
  response: GdbResponse
};
