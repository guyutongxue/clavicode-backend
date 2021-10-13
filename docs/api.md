# API 说明

## 定义

- `$PREFIX` 代表此项目的运行根目录。

```ts
type RuntimeError = 'timeout' | 'violate' | 'other';
type GccDiagnostics = /* see devcpp7 */;
type GdbResponse = /* see tsgdbmi */;
```

## 前端访问

```
GET $PREFIX/
```

访问前端页面。

#### searchParam

> OJ 相关，未定

#### hash

由 Angular 路由处理。

## 前后端交互（HTTPS）

HTTPS 使用 REST 风格交互：请求和响应都是 JSON 格式。下文中，以 TypeScript 类型声明来描述它们。

### C++ 编译

```
POST $PREFIX/cpp/compile
```

#### 格式

```ts
type CppCompileRequest = {
  code: string;
  execute: 'none' | 'file' | 'interactive';
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
};
```

前端获取到 `executeToken` 后，将其作为 `$EXECUTE_TOKEN` 以进行 WebSocket 交互。

### C++ 调试

```
POST $PREFIX/cpp/debug
```

#### 格式

```ts
type CppDebugRequest = {
  code: string
};
type CppDebugResponse = {
  status: 'error' | 'ok';
  error?: GccDiagnostics; // If status is 'error'
  debugToken?: string;    // If status is 'ok' 
  expireDate?: string;    // If status is 'ok'
}
```

前端获取到 `debugToken` 后，将其作为 `$DEBUG_TOKEN` 以进行 WebSocket 交互。

### Clangd 语言服务请求

```
POST $PREFIX/cpp/lsp
```

#### 格式

```ts
type CppLspRequest = {}
type CppLspResponse = {
  success: boolean;
  token: string;      // If success is true
  expireDate: string; // If success is true
}
```

### C++ 获取可执行文件

```
POST $PREFIX/cpp/download
```

#### 格式

```ts
type CppDownloadRequest = {
  code: string;
  platform: 'mingw' | 'linux' | 'darwin';
};
type CppDownloadResponse = {
  downloadLink: string;
  expireDate: string;
};
```

## 前后端交互（WebSocket）

WebSocket 中传输的字符串应全部为 JSON 格式。

### C++ 运行

```
ws://$PREFIX/ws/execute/$EXECUTE_TOKEN
```

对 `$EXECUTE_TOKEN` 所指代进程作 IO 交互。

#### 格式
```ts
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
  exitCode: number;
} | {
  type: 'error';
  reason: RuntimeError;
} | {
  type: 'output';
  stream: 'stdout' | 'stderr';
  content: string;
}
```

### Clangd 语言服务器

```
ws://$PREFIX/ws/languageServer/clangd/$TOKEN
```

与 Clangd 语言服务器交互，需传入 `$TOKEN` 以进行身份验证。交互格式由 LSP 规范规定。

### GDB 调试

```
ws://$PREFIX/ws/debug/gdb/$DEBUG_TOKEN
```

与 GDB-MI 交互。

#### 格式

```ts
type WsDebugGdbC2S = {
  type: 'start';
} | {
  type: 'request';
  request: string;
} | {
  type: 'input';
  content: string;
} | {
  type: 'shutdown';
};
type WsDebugGdbS2C = {
  type: 'started';
} | {
  type: 'closed';
  exitCode: number;
} | {
  type: 'error';
  reason: RuntimeError;
} | {
  type: 'response';
  response: GdbResponse;
} | {
  type: 'output';
  content: string;
};
```

## OJ 相关

> REST 风格，待定

```
POST $PREFIX/oj/commit
GET $PREFIX/oj/getProblem
GET $PREFIX/oj/listProblems
POST $PREFIX/oj/setProblemSet
GET $PREFIX/oj/listProblemSets
POST $PREFIX/oj/setCourse
GET $PREFIX/oj/listCourses
GET $PREFIX/oj/history
```
