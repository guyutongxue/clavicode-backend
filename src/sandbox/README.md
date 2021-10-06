# Sandbox

## Preparation

### Compilers and toolchains

```sh
sudo add-apt-repository -y ppa:ubuntu-toolchain-r/test
sudo apt install gcc-11 g++-11
sudo update-alternatives --remove-all cpp # may required
sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-9 90 --slave /usr/bin/g++ g++ /usr/bin/g++-9 --slave /usr/bin/gcov gcov /usr/bin/gcov-9 --slave /usr/bin/gcc-ar gcc-ar /usr/bin/gcc-ar-9 --slave /usr/bin/gcc-ranlib gcc-ranlib /usr/bin/gcc-ranlib-9  --slave /usr/bin/cpp cpp /usr/bin/cpp-9 && \
sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-11 110 --slave /usr/bin/g++ g++ /usr/bin/g++-11 --slave /usr/bin/gcov gcov /usr/bin/gcov-11 --slave /usr/bin/gcc-ar gcc-ar /usr/bin/gcc-ar-11 --slave /usr/bin/gcc-ranlib gcc-ranlib /usr/bin/gcc-ranlib-11  --slave /usr/bin/cpp cpp /usr/bin/cpp-11;

sudo apt install cmake
```

### 3rd-party libraries

```sh
sudo apt install libseccomp-dev
sudo apt install libboost-all-dev
```

## Build

```sh
mkdir build && cd build
cmake ..
make
```

## Test

```sh
cd ../test
make
cd ../bin
./sandbox --exe_path=../test/_chat
```

## Acknowledgement

`QingdaoU/Judger` by Qingdao University.
