# Use Bun's official image
FROM oven/bun:latest

WORKDIR /home/bun/app

COPY package.json bun.lockb* ./
RUN bun install

COPY ./src ./src
COPY tsconfig.json ./

RUN bun run tsc

ENV TZ="Europe/Paris"

CMD ["bun", "run", "start"]
