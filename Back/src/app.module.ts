import {
  MiddlewareConsumer,
  Module,
  NestModule,
  Logger,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import type { NextFunction, Request, Response } from "express";

import { validateEnv } from "./config/env.validation";
import { DeparturesModule } from "./departures/departures.module";
import { RedisModule } from "./redis/redis.module";

const httpLogger = new Logger("HTTP");

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    RedisModule,
    DeparturesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: Request, res: Response, next: NextFunction) => {
        const startedAt = Date.now();
        httpLogger.log(`--> ${req.method} ${req.originalUrl}`);

        res.on("finish", () => {
          const line = `<-- ${req.method} ${req.originalUrl} ${res.statusCode} +${Date.now() - startedAt}ms`;

          if (res.statusCode >= 500) {
            httpLogger.error(line);
          } else if (res.statusCode >= 400) {
            httpLogger.warn(line);
          } else {
            httpLogger.log(line);
          }
        });

        next();
      })
      .forRoutes("*");
  }
}
