FROM node:9.11.1-alpine

WORKDIR /usr/src/app

COPY ./src /usr/src/app
COPY ./package.json /usr/src/app/package.json

RUN npm install

CMD node index.js