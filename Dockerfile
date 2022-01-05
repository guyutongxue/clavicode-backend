FROM mongo:5.0

# https://stackoverflow.com/questions/25899912/how-to-install-nvm-in-docker

# Replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Install all dependencies
RUN apt update --fix-missing \
  && apt install -y curl git \
  && apt install -y build-essential libssl-dev \
  && apt install -y software-properties-common
RUN add-apt-repository -y ppa:ubuntu-toolchain-r/test
RUN apt install -y gcc-11 g++-11 \
  && update-alternatives --remove-all cpp \
  && update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-9 90 --slave /usr/bin/g++ g++ /usr/bin/g++-9 --slave /usr/bin/gcov gcov /usr/bin/gcov-9 --slave /usr/bin/gcc-ar gcc-ar /usr/bin/gcc-ar-9 --slave /usr/bin/gcc-ranlib gcc-ranlib /usr/bin/gcc-ranlib-9  --slave /usr/bin/cpp cpp /usr/bin/cpp-9 \
  && update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-11 110 --slave /usr/bin/g++ g++ /usr/bin/g++-11 --slave /usr/bin/gcov gcov /usr/bin/gcov-11 --slave /usr/bin/gcc-ar gcc-ar /usr/bin/gcc-ar-11 --slave /usr/bin/gcc-ranlib gcc-ranlib /usr/bin/gcc-ranlib-11  --slave /usr/bin/cpp cpp /usr/bin/cpp-11 \
  && apt install -y cmake libseccomp-dev libboost-all-dev \
  && apt install -y gdb clangd-12

ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 16.13.0

# Install nvm with node and npm
RUN mkdir -p $NVM_DIR \
  && curl https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash \
  && source $NVM_DIR/nvm.sh \
  && nvm install $NODE_VERSION \
  && nvm alias default $NODE_VERSION \
  && nvm use default

ENV NODE_PATH $NVM_DIR/v$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# Fetch and build frontend
RUN git clone https://github.com/Guyutongxue/clavicode-frontend.git /var/frontend \
  && cd /var/frontend \
  && npm install -g @angular/cli yarn pyright \
  && npm install \
  && ng build 

RUN mkdir /var/backend \
  && mkdir /var/backend/logs

WORKDIR /var/backend

# log dir
VOLUME /var/backend/log

# Bundle app source
COPY . /var/backend

RUN yarn \
  && yarn build \
  && ln -s /var/frontend/dist ./static 

EXPOSE 3000
ENV PORT 3000
ENV PROD 1
CMD ["sh", "-c", "mongod &> /dev/null & yarn run:prod"]
