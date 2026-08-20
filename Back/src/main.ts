import "reflect-metadata";

import { Logger, LogLevel } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { ZodValidationPipe } from "nestjs-zod";

import { AppModule } from "./app.module";
import { LOG_LEVELS } from "./config/env.validation";
import { buildOpenApiDocument } from "./openapi";

/**
 * LOG_LEVEL selects the most verbose level to emit (default: debug, so
 * every step of every call is traced; set LOG_LEVEL=log to quiet down).
 */
function resolveLogLevels(): LogLevel[] {
  const requested = process.env.LOG_LEVEL || "debug";
  const index = (LOG_LEVELS as readonly string[]).indexOf(requested);

  return LOG_LEVELS.slice(0, index === -1 ? 4 : index + 1) as LogLevel[];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: resolveLogLevels(),
  });

  app.useGlobalPipes(new ZodValidationPipe());
  app.enableShutdownHooks();

  const document = buildOpenApiDocument(app);
  SwaggerModule.setup("docs", app, document, {
    jsonDocumentUrl: "docs-json",
  });

  const port = process.env.PORT || 80;
  await app.listen(port);

  new Logger("Bootstrap").log(
    `KrampNCF API listening on port ${port} — Swagger UI at /docs`,
  );
}

void bootstrap();
