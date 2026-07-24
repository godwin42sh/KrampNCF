import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import {
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";

import { RT_FETCH_TYPES } from "../config/env.validation";
import type { CrawlRes } from "../types/CrawlRes";
import type { IsCached } from "../types/IsCached";
import type { DeparturesResponse } from "../types/Response";
import { DeparturesService } from "./departures.service";
import { getDateFromQuery } from "./departures.utils";
import {
  AwtrixResponseDto,
  CrawlFlareQueryDto,
  DateFromQueryDto,
  DeparturesResponseDto,
  FormatQueryDto,
} from "./dto/departures.dto";
import type { AwtrixResponse } from "./awtrix.utils";

@ApiTags("departures")
@ApiExtraModels(DeparturesResponseDto, AwtrixResponseDto)
@Controller()
export class DeparturesController {
  constructor(private readonly departures: DeparturesService) {}

  private parseDateFrom(dateFrom?: string): Date {
    const parsed = getDateFromQuery(dateFrom);

    if (!parsed) {
      throw new BadRequestException("Invalid dateFrom parameter");
    }

    return parsed;
  }

  @Get("departuresRT")
  @ApiOperation({
    summary: "Realtime departures for both configured directions (GTFS-RT)",
  })
  @ApiOkResponse({ type: [DeparturesResponseDto] })
  @ApiServiceUnavailableResponse({
    description: "GTFS-RT feed could not be fetched",
  })
  async departuresRT(): Promise<DeparturesResponse[]> {
    return this.departures.getRealtimeBothDirections();
  }

  @Get("departuresRT/:id")
  @ApiOperation({ summary: "Realtime departures for one line (GTFS-RT)" })
  @ApiParam({ name: "id", type: Number, description: "Line id" })
  @ApiOkResponse({ type: DeparturesResponseDto })
  @ApiNotFoundResponse({ description: "Line not found" })
  @ApiServiceUnavailableResponse({
    description: "GTFS-RT feed could not be fetched",
  })
  async departuresRTById(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<DeparturesResponse> {
    return this.departures.getRealtimeForLine(id);
  }

  @Get("departures")
  @ApiOperation({
    summary:
      "Scheduled departures for all configured lines, merged with the default realtime source",
  })
  @ApiOkResponse({ type: [DeparturesResponseDto] })
  async departuresAll(
    @Query() query: DateFromQueryDto,
  ): Promise<DeparturesResponse[]> {
    const dateFrom = this.parseDateFrom(query.dateFrom);

    return this.departures.fetchAllLines(
      dateFrom,
      this.departures.resolveFetchType(),
    );
  }

  @Get(["departures/:id", "departures/:id/:typeFetch"])
  @ApiOperation({
    summary:
      "Scheduled departures for one line, merged with a realtime source",
  })
  @ApiParam({ name: "id", type: Number, description: "Line id" })
  @ApiParam({
    name: "typeFetch",
    required: false,
    enum: RT_FETCH_TYPES,
    description: "Realtime source used to enrich the scheduled data",
  })
  @ApiOkResponse({ type: DeparturesResponseDto })
  @ApiNotFoundResponse({ description: "Line not found" })
  async departuresById(
    @Param("id", ParseIntPipe) id: number,
    @Query() query: DateFromQueryDto,
    @Param("typeFetch") typeFetch?: string,
  ): Promise<DeparturesResponse> {
    const lineData = this.departures.findLineData(id);
    const dateFrom = this.parseDateFrom(query.dateFrom);

    return this.departures.fetchLine(
      lineData,
      dateFrom,
      this.departures.resolveFetchType(typeFetch),
    );
  }

  @Get("departuresPrim/:id")
  @ApiOperation({ summary: "Realtime departures from the PRIM SIRI Lite API" })
  @ApiParam({ name: "id", type: Number, description: "PRIM line id" })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(DeparturesResponseDto) },
        { $ref: getSchemaPath(AwtrixResponseDto) },
      ],
    },
  })
  @ApiNotFoundResponse({ description: "Prim data not found / no departures" })
  @ApiServiceUnavailableResponse({ description: "PRIM API not configured" })
  async departuresPrim(
    @Param("id", ParseIntPipe) id: number,
    @Query() query: FormatQueryDto,
  ): Promise<DeparturesResponse | AwtrixResponse> {
    const primData = this.departures.findPrimData(id);
    const departuresRes = await this.departures.getPrimDepartures(primData);

    if (departuresRes === false) {
      throw new NotFoundException("No departures found");
    }

    if (query.format === "awtrix") {
      return this.departures.toAwtrix(departuresRes);
    }

    return departuresRes;
  }

  @Get("departuresPrimByType/:type")
  @ApiOperation({
    summary: "Realtime PRIM departures for every line of a given type",
  })
  @ApiParam({ name: "type", type: String, example: "TER" })
  @ApiOkResponse({ type: [DeparturesResponseDto] })
  @ApiNotFoundResponse({ description: "Prim data not found" })
  @ApiServiceUnavailableResponse({ description: "PRIM API not configured" })
  async departuresPrimByType(
    @Param("type") type: string,
  ): Promise<DeparturesResponse[]> {
    return this.departures.getPrimDeparturesByType(type);
  }

  @Get("departuresSiri/:id")
  @ApiOperation({
    summary:
      "Realtime departures from the national SIRI ET feed (delays + platforms, RER C and TER/Rémi)",
  })
  @ApiParam({ name: "id", type: Number, description: "Siri board id" })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(DeparturesResponseDto) },
        { $ref: getSchemaPath(AwtrixResponseDto) },
      ],
    },
  })
  @ApiNotFoundResponse({ description: "Siri board not found" })
  @ApiServiceUnavailableResponse({
    description: "SIRI ET feed could not be fetched",
  })
  async departuresSiri(
    @Param("id", ParseIntPipe) id: number,
    @Query() query: FormatQueryDto,
  ): Promise<DeparturesResponse | AwtrixResponse> {
    const departuresRes = await this.departures.getSiriBoard(id);

    if (query.format === "awtrix") {
      return this.departures.toAwtrix(departuresRes);
    }

    return departuresRes;
  }

  @Get("departuresSiriByType/:type")
  @ApiOperation({
    summary: "SIRI ET departures for every board of a given type",
  })
  @ApiParam({ name: "type", type: String, example: "train" })
  @ApiOkResponse({ type: [DeparturesResponseDto] })
  @ApiNotFoundResponse({ description: "Siri board not found" })
  @ApiServiceUnavailableResponse({
    description: "SIRI ET feed could not be fetched",
  })
  async departuresSiriByType(
    @Param("type") type: string,
  ): Promise<DeparturesResponse[]> {
    return this.departures.getSiriBoardsByType(type);
  }

  @Get("departuresCrawl/:id")
  @ApiOperation({
    summary: "Departures scraped from the ter.sncf.com schedule page",
  })
  @ApiParam({ name: "id", type: Number, description: "Line id" })
  @ApiNotFoundResponse({ description: "Line not found" })
  @ApiServiceUnavailableResponse({ description: "Crawl not configured" })
  async departuresCrawl(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<IsCached<CrawlRes[]>> {
    return this.departures.getCrawlDepartures(id);
  }

  @Get("departuresCrawlFlare")
  @ApiOperation({
    summary:
      "Departures crawled through FlareSolverr for all configured stations",
  })
  @ApiOkResponse({
    schema: {
      type: "array",
      items: {
        oneOf: [
          { $ref: getSchemaPath(DeparturesResponseDto) },
          { $ref: getSchemaPath(AwtrixResponseDto) },
        ],
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: "FlareSolverr crawl not configured",
  })
  async departuresCrawlFlareAll(
    @Query() query: CrawlFlareQueryDto,
  ): Promise<(DeparturesResponse | AwtrixResponse)[]> {
    const departures = await this.departures.getAllCrawlFlareDepartures(
      query.type,
    );

    if (query.format === "awtrix") {
      return departures.map((departure) => this.departures.toAwtrix(departure));
    }

    return departures;
  }

  @Get("departuresCrawlFlare/:id")
  @ApiOperation({
    summary: "Departures crawled through FlareSolverr for one station",
  })
  @ApiParam({ name: "id", type: Number, description: "Crawl data id" })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(DeparturesResponseDto) },
        { $ref: getSchemaPath(AwtrixResponseDto) },
      ],
    },
  })
  @ApiNotFoundResponse({ description: "Crawl data not found" })
  @ApiServiceUnavailableResponse({
    description: "FlareSolverr crawl not configured",
  })
  async departuresCrawlFlareById(
    @Param("id", ParseIntPipe) id: number,
    @Query() query: CrawlFlareQueryDto,
  ): Promise<DeparturesResponse | AwtrixResponse> {
    const departuresRes = await this.departures.getCrawlFlareDepartures(
      id,
      query.type,
    );

    if (query.format === "awtrix") {
      return this.departures.toAwtrix(departuresRes);
    }

    return departuresRes;
  }
}
