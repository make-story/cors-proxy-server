# 도커 이미지 생성을 위한 설정파일 
# '.dockerignore' 파일에 Docker 이미지 생성 시 이미지안에 들어가지 않을 파일을 지정

# base image
# <이미지 이름>:<태그>
# alpine 버전은 node.js 공식 이미지보다 몇 배나 가볍습니다.
# https://hub.docker.com/_/node
# https://github.com/buildkite/docker-puppeteer
FROM node:10.9.0-alpine
FROM buildkite/puppeteer:latest 

# set working directory - 작업 디렉토리 생성 및 고정
# Dockerfile의 모든 명령어는 기본적으로 /(루트) 디렉토리에서 실행
# 1. Dockerfile의 각 줄은 경로를 공유하지 않는다. 
# 즉, 명시적으로 WORKDIR 명령어를 통해 새로운 루트 경로를 설정하지 않는 이상 경로는 /에 고정됩니다.
# 2. WORKDIR을 사용하면 경로를 고정할 수 있다.
# 만약 같은 경로에서 여러 작업을 해야한다면 WORKDIR을 사용할 수 있습니다.
# 3. 왼쪽은 호스트 머신의 파일 경로, 오른쪽은 컨테이너의 파일 경로
WORKDIR /app

# 환경 변수를 설정합니다. 
# ENV로 설정한 환경 변수는 RUN, CMD, ENTRYPOINT 에 적용됩니다.
# `/app/node_modules/.bin`을 $PATH 에 추가
ENV PATH /app/node_modules/.bin:$PATH
#ENV PATH="${PATH}:/node_modules/.bin"

# app dependencies, install 및 caching
# 여기서 왼쪽은 호스트 파일의 경로, 오른쪽은 컨테이너의 파일 경로가 됩니다.
# 즉, 현재 프로젝트 디렉토리의 package.json이 컨테이너의 app 폴더 아래에 복사됩니다.
COPY package.json /app/package.json
#COPY package*.json ./

# package.json 의존성 모듈 install
# RUN 명령어는 배열['npm', 'install'] 형태로도 사용할 수 있습니다.
# <npm 사용방식>
#RUN npm install --unsafe-perm=true --allow-root
# <yarn 사용방식>
RUN npm i -g yarn && yarn install

# nodemon 설치
#RUN npm install -g nodemon
#RUN yarn global add nodemon

# src 폴더 아래의 코드 복사
COPY . /app/
#COPY ./src/ /app/

# 접근 포트 설정
#EXPOSE 3000 3000

# 앱 실행
# CMD 명령은 Dockerfile 에서 한번만 사용 가능
CMD ["node", "servers/proxy.js"]
# <npm 사용방식>
#CMD ["npm", "start"]
# <yarn 사용방식>
#CMD ["yarn", "start"]

# 도커관련 설정(Dockerfile - 현재파일)을 참고해 이미지 생성 명령
# $ docker build -t makestory/cors-proxy:latest .

# 도커 이미지로 컨테이너 생성/실행
# $ docker run --name cors-proxy -p 3291:3291 --restart unless-stopped -d makestory/cors-proxy:latest

# 참고: docker run 명령은 우리가 docker build라는 명령으로 생성한 이미지를 바탕으로 도커 컨테이너 인스턴스(Docker Container Instance)를 생성하고 실행
# 참고: -v ${PWD}:/app은 React 코드를 “/app”에 존재하는 컨테이너에 마운트 합니다.(윈도우는 {PWD}가 작동하지 않을 수 있습니다.)
# 참고: -v /app/node_modules는 다른 볼륨에서 “node_modules”를 사용하도록 해줍니다.
# 참고: -p 3001:3000은 포트 옵션입니다. 3000번은 같은 도커 컨테이너 내에서 접근할 수 있는 포트번호, 3001번은 외부에서 접근할 수 있는 포트번호입니다.
# 참고: --rm 옵션은 컨테이너가 종료되면 자동으로 삭제하라는 의미입니다.

# 이미지 실행 후 정상 접속 확인
# http://localhost:3001

# Docker Compose 사용(docker-compose.yml 파일 - “YAML”파일)하면 더 간단한 방식(docker run 명령 단순화)으로 도커 애플리케이션 정의/실행 가능
# $ docker-compose up -d --build