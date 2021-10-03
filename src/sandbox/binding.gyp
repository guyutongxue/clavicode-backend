{
  'targets': [
    {
      'target_name': 'sandbox',
      'sources': [ 'src/main.cpp' ],
      'defines': [ 'V8_DEPRECATION_WARNINGS=1' ],
      'cflags_cc': [ 
        '-std=c++17',
        '-Wall',
        '-Wextra',
        '-Werror',
        '-O3',
        '-pie',
        '-fPIC',
        '-Wno-cast-function-type' 
      ]
    }
  ]
}
