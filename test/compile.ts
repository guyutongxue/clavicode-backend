import { compileHandler } from "../src/compile_handler";

const TEST_SOURCES: {
  title: string;
  source: string;
  stdin?: string;
}[] = [
  {
    title: 'hello_world',
    source: `#include <iostream>
int main() {
  std::cout << "Hello, world!" << std::endl;
}`
  },
  {
    title: 'count_string',
    source: `#include <iostream>
#include <string>
int main() {
  std::string s;
  std::cin >> s;
  std::cout << "Size: " << s.size() << std::endl;
}`,
    stdin: 'Guyutongxue'
  },
  {
    title: 'compile_error',
    source: `#include <iostream>
int main() {
  std::cout << "Hello, world!" << std::endl
}`
  },
  {
    title: 'link_error',
    source: `void f() {}`
  },
  {
    title: 'timeout',
    source: `int main() {
  while (true);
}`
  },
  {
    title: 'violate',
    source: `#include <cstdlib>
int main() {
  system("echo hello");
}`
  },
  {
    title: 'runtime_error',
    source: `int main() {
  int a[2];
  a[66600000] = 42;
}`
  }
];



(async () => {
  for (const test of TEST_SOURCES) {
    console.log(`Testing ${test.title}...`);
    const result = await compileHandler({
      code: test.source,
      execute: 'file',
      stdin: test.stdin ?? '',
    });
    console.log(result);
  }
})();
