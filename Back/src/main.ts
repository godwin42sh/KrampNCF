import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ZodValidationPipe, cleanupOpenApiDoc } from "nestjs-zod";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ZodValidationPipe());
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle("KrampNCF API")
    .setDescription(
      "SNCF departures aggregation API — merges Navitia scheduled data with " +
        "realtime sources (GTFS-RT, PRIM SIRI Lite, ter.sncf.com crawls).",
    )
    .setVersion("2.0.0")
    .build();

  const document = cleanupOpenApiDoc(
    SwaggerModule.createDocument(app, swaggerConfig),
  );
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
