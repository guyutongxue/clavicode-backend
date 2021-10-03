#!/bin/bash

# Due to https://github.com/nodejs/node-gyp/issues/2305 ,
# node-gyp generate compile_commands.json in wrong place.
# Move it to the build directory.

node-gyp configure
echo -n "Generating compile_commands.json... "
node-gyp configure -- -f compile_commands_json > /dev/null 2>&1
echo done.
mv Debug/compile_commands.json build/
rm -r Debug Release
