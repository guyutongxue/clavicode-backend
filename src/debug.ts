import pty from "node-pty";
import { GdbController } from "@gytx/tsgdbmi";
import{WsDebugGdbS2C} from './api';
import { file } from "tmp";
type Condition = 'begin' | 'pause' | 'else';
let condition: Condition = 'begin';
let deviceName:string;
function send(ws:ws,msg:WsDebugGdbS2C){
  ws.send(Buffer.from(JSON.stringify({
    msg
  })));
}
export function debugExecution(ws: ws, filename: string) {
  // Launch a pseudo-terminal, for gdb debuggee's io.

  // Print current tty device name, and keep terminal open.
  const ptyProcess = pty.spawn("./utils/bin/pause", [], {
    cwd: process.cwd(),
    env: process.env as { [key: string]: string },
  });
  ptyProcess.onData(function (data) {
    // devicename
    if (condition === 'begin') {
      deviceName = data;
      condition = 'else';
    }
    else if (condition === 'pause') {
      //重新打开
      send(ws,{
        type: 'tout',
        content: data,
      });
    }
    //else condition===else ignore
  });

  // Launch gdb.
  const gdb = new GdbController('GBK');
  // set follow-fork-mode child
  gdb.sendRequest("-gdb-set follow-fork-mode")?.then(value => {
    console.log("response: ", value);
    send(ws,{type:'started',sourceFilePath:filename});
  });
  // catch exec
  gdb.sendRequest("catch exec");
  // tty <tty device>
  gdb.sendRequest("-inferior-tty-set "+deviceName);
  // file sandbox/bin/sandbox
  gdb.sendRequest("-file-exec-and-symbols ../sandbox/bin/sandbox");
  // run --exe_path="<debuggee>"
  gdb.sendRequest("-exec-run");
  gdb.sendRequest("-gdb-set-args --exe_path="+filename);
  // gdb will break on `exec`

  // file "<debuggee>"
  gdb.sendRequest("-file-exec-and-symbols "+filename);
  // set breakpoints
  
  // continue

  // Listen to gdb's output and interact with tty below.

  ptyProcess.write("Hello\r"); // replace \n with ENTER (\r)
  ptyProcess.write("Bye\r");
  ptyProcess.write("\x04"); // EOF

  // When program exit

  ptyProcess.kill();

}
