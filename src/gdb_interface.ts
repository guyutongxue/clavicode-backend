import pty from "node-pty";

// Launch a pseudo-terminal, for gdb debuggee's io.

// Print current tty device name, and keep terminal open.
const ptyProcess = pty.spawn("./utils/bin/pause", [], {
  cwd: process.cwd(),
  env: process.env as any,
});
ptyProcess.onData(function (data) {
  // First get tty device name
  process.stdout.write(data);
  // make it silent to prevent gdb warning

  // reopen after break on `exec`
});

// Launch gdb.
// set follow-fork-mode child
// catch exec
// tty <tty device>
// file sandbox/bin/sandbox
// run --exe_path="<debuggee>"

// gdb will break on `exec`

// file "<debuggee>"

// set breakpoints

// continue

// Listen to gdb's output and interact with tty below.

ptyProcess.write("Hello\r"); // replace \n with ENTER (\r)
ptyProcess.write("Bye\r");
ptyProcess.write("\x04"); // EOF

// When program exit

ptyProcess.kill();
