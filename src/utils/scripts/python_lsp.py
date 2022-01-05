#!/bin/python3

import sys
from pylsp.python_lsp import start_io_lang_server, PythonLSPServer

start_io_lang_server(sys.stdin.buffer, sys.stdout.buffer, False, PythonLSPServer)
