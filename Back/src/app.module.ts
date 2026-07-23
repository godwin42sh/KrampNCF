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
        httpLogger.log(`${req.method} ${req.originalUrl}`);
        next();
      })
      .forRoutes("*");
  }
}
