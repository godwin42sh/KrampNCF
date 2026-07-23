# Pinned slim image instead of :latest (§3.3 of the optimization report)
FROM oven/bun:1-slim

WORKDIR /home/bun/app

# bun.lock (text lockfile) — the previous glob bun.lockb* never matched it,
# so images were built without a lockfile (§3.1)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY ./src ./src

ENV TZ="Europe/Paris"
ENV NODE_ENV=production

EXPOSE 80

# Bun runs TypeScript natively — no tsc emit step needed (§3.2);
# type-checking happens in CI instead.
CMD ["bun", "src/main.ts"]
