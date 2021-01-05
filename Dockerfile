FROM node:alpine

WORKDIR /usr/src/app

COPY ./src /usr/src/app
COPY ./package.json /usr/src/app/package.json
COPY ./config.json.example /config.json.example

RUN npm install
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]