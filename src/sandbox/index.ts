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

type SandboxConfig = {
  input_path: string;
  output_path: string;
  arguments: string[];
  environment: string[];
  log_path: string;
  uid: number;
  gid: number;
  max_cpu_time: number;
  max_memory: number;
  max_stack: number;
  max_process_number: number;
  max_output_size: number;
};

type Sandbox = (executable: string, config: Partial<SandboxConfig>) => number;

const sandbox: Sandbox = require('./build/Release/sandbox.node');

export default sandbox;
