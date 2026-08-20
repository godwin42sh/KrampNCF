import "reflect-metadata";

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { NestFactory } from "@nestjs/core";

import { buildOpenApiDocument } from "./openapi";

/**
 * Writes openapi.json to the Back/ root without starting the HTTP server:
 * `bun run openapi`.
 *
 * The required env vars only gate runtime features (Redis is lazy-connect,
 * upstream APIs are called per request), so placeholders are enough to
 * satisfy the boot-time validation when generating offline.
 */
const PLACEHOLDER_ENV: Record<string, string> = {
  REDIS_URL: "redis://localhost:6379",
  SNCF_API_URL: "https://placeholder.invalid",
  SNCF_API_KEY: "placeholder",
  SNCF_GTFSRT_URL: "https://placeholder.invalid",
};

for (const [key, value] of Object.entries(PLACEHOLDER_ENV)) {
  process.env[key] ??= value;
}

async function generate() {
  // Imported lazily: ConfigModule.forRoot() validates the environment as
  // soon as app.module.ts is loaded, so the placeholders must be in place
  // before the import runs.
  const { AppModule } = await import("./app.module");

  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });

  try {
    const json = `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`;
    const path = resolve(import.meta.dir, "..", "openapi.json");

    writeFileSync(path, json);
    console.log(`Wrote ${path}`);
  } finally {
    await app.close();
  }
}

void generate().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
