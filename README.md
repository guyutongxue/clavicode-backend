# Online IDE `clavicode` backend

## Build instructions

### Preparation

Install C++/Python environment: `gcc-11` `g++-11` `gdb` `clangd-12` `python-is-python3`.

Install tools and libraries for building C++ sources: `cmake` `libseccomp-dev` `libboost-all-dev`.

Install Node.js for build and run TypeScript sources. We suggest using `nvm`. See [nvm-sh/nvm](https://github.com/nvm-sh/nvm).

We use `yarn` as TS/JS package manager. Install `yarn` with:

```
npm i -g yarn
```

We use `pyvenv` for Python environment. Create it with:

```
scripts/create_pyvenv.sh
```

### Install dependencies

```
yarn
```

### Run with hot reload

```
yarn start:dev
```

Then communicate backend on `localhost:3000`.

### Production

Copy or link frontend assets to `static` folder. Then:

```
yarn build
yarn run:prod
```

## Docker

We've provided a `Dockerfile`, from which you can create a image. But it does not recently tested. If something wrong happens, open an issue please.

