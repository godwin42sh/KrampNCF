FROM node:lts-alpine

WORKDIR /home/node/app

COPY package*.json ./
RUN npm install

COPY ./src ./src
COPY tsconfig.json ./

RUN npm run build

ENV TZ="Europe/Paris"

ENV REDIS_URL=""
ENV SNCF_API_URL=""
ENV SNCF_API_KEY=""

CMD [ "npm", "run", "start" ]