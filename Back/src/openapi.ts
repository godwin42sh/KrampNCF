import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";

/**
 * Shared between the runtime Swagger UI (main.ts) and the offline
 * spec generator (generate-openapi.ts) so both always describe the
 * same API.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("KrampNCF API")
    .setDescription(
      "SNCF departures aggregation API — merges Navitia scheduled data with " +
        "realtime sources (GTFS-RT, PRIM SIRI Lite, ter.sncf.com crawls).",
    )
    .setVersion("2.0.0")
    .build();

  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}
