import { Module } from "@nestjs/common";

import { CrawlFlareService } from "../crawl/crawl-flare.service";
import { CrawlService } from "../crawl/crawl.service";
import { GtfsService } from "../gtfs/gtfs.service";
import { PrimService } from "../prim/prim.service";
import { SncfService } from "../sncf/sncf.service";
import { DeparturesController } from "./departures.controller";
import { DeparturesService } from "./departures.service";

@Module({
  controllers: [DeparturesController],
  providers: [
    DeparturesService,
    SncfService,
    GtfsService,
    PrimService,
    CrawlService,
    CrawlFlareService,
  ],
})
export class DeparturesModule {}
