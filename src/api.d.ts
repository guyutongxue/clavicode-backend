import {GdbResponse} from 'tsgdbmi';

interface GccDiagnosticPosition {
  file: string;
  line: number;
  column: number;
  "display-column"?: number;
  "byte-column"?: number;
}
interface GccDiagnosticLocation {
  label?: string;
  caret: GccDiagnosticPosition;
  start?: GccDiagnosticPosition;
  finish?: GccDiagnosticPosition;
}
interface GccDiagnosticFixit {
  start: GccDiagnosticPosition;
  next: GccDiagnosticPosition;
  string: string;
}
interface GccDiagnosticEvent {
  depth: number;
  description: string;
  function: string;
  location: GccDiagnosticPosition;
}
interface GccDiagnostic {
  kind: "note" | "warning" | "error";
  message: string;
  option?: string;
  option_url?: string;
  locations: GccDiagnosticLocation[];
  fixits?: GccDiagnosticFixit[];
  path?: GccDiagnosticEvent[];
  children?: GccDiagnostic[];
}
export type GccDiagnostics = GccDiagnostic[];


type CppCompileRequest = {
  code: string;
  execute: 'none' | 'file' | 'interactive' | 'debug';
  stdin?: string;         // If execute is 'file'
};
type CppCompileResponse = {
  status: 'error';
  errorType: 'compile' | 'link' | 'other';
  error: GccDiagnostics | string; // GccDiagnostics for 'compile', string for others 
} | {
  status: 'ok';
  execute: 'none';        // If `execute` in request is 'none'
} | {
  status: 'ok';
  execute: 'file';        // If `execute` in request is 'file'
  result: 'ok' | 'error';
  exitCode?: number;      // If result is 'ok'
  reason?: RuntimeError;  // If result is 'error'
  stdout: string;
  stderr: string;
} | {
  status: 'ok';
  execute: 'interactive'; // If `execute` in request is 'interactive'
  executeToken: string;
  expireDate: string;
} | {
  status: 'ok';
  execute: 'debug';       // If `execute` in request in 'debug'
  debugToken: string;    // If status is 'ok' 
  expireDate: string;    // If status is 'ok'
};

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
