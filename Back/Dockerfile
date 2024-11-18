FROM node:lts-alpine

WORKDIR /home/node/app

COPY package*.json ./
RUN npm install

COPY ./src ./src
COPY tsconfig.json ./

RUN npm run build

ENV TZ="Europe/Paris"

CMD [ "npm", "run", "start" ]