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
import type { QueryType } from "../types/QueryTypes";
import type { DeparturesResponse } from "../types/Response";
import { DeparturesService } from "./departures.service";
import { getDateFromQuery } from "./departures.utils";
import {
  AwtrixResponseDto,
  CrawlFlareListQueryDto,
  CrawlFlareQueryDto,
  CrawlResponseDto,
  DeparturesAllQueryDto,
  DeparturesByIdQueryDto,
  DeparturesResponseDto,
  FormatQueryDto,
  ListQueryDto,
} from "./dto/departures.dto";
import type { AwtrixResponse } from "./awtrix.utils";

const BOARD_OR_AWTRIX = {
  oneOf: [
    { $ref: getSchemaPath(DeparturesResponseDto) },
    { $ref: getSchemaPath(AwtrixResponseDto) },
  ],
};

const BOARD_OR_AWTRIX_LIST = {
  type: "array",
  items: BOARD_OR_AWTRIX,
};

@ApiTags("departures")
@ApiExtraModels(DeparturesResponseDto, AwtrixResponseDto, CrawlResponseDto)
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

  private formatBoard(
    board: DeparturesResponse,
    format?: QueryType,
  ): DeparturesResponse | AwtrixResponse {
    return format === "awtrix" ? this.departures.toAwtrix(board) : board;
  }

  private formatBoards(
    boards: DeparturesResponse[],
    format?: QueryType,
  ): (DeparturesResponse | AwtrixResponse)[] {
    return format === "awtrix"
      ? boards.map((board) => this.departures.toAwtrix(board))
      : boards;
  }

  @Get("departuresRT")
  @ApiOperation({
    summary: "Realtime departures for both configured directions (GTFS-RT)",
  })
  @ApiOkResponse({ schema: BOARD_OR_AWTRIX_LIST })
  @ApiNotFoundResponse({ description: "No board departing from ?from=" })
  @ApiServiceUnavailableResponse({
    description: "GTFS-RT feed could not be fetched",
  })
  async departuresRT(
    @Query() query: ListQueryDto,
  ): Promise<(DeparturesResponse | AwtrixResponse)[]> {
    const boards = await this.departures.getRealtimeBothDirections(query.from);

    return this.formatBoards(boards, query.format);
  }

  @Get("departuresRT/:id")
  @ApiOperation({ summary: "Realtime departures for one line (GTFS-RT)" })
  @ApiParam({ name: "id", type: Number, description: "Line id" })
  @ApiOkResponse({ schema: BOARD_OR_AWTRIX })
  @ApiNotFoundResponse({ description: "Line not found" })
  @ApiServiceUnavailableResponse({
    description: "GTFS-RT feed could not be fetched",
  })
  async departuresRTById(
    @Param("id", ParseIntPipe) id: number,
    @Query() query: FormatQueryDto,
  ): Promise<DeparturesResponse | AwtrixResponse> {
    const board = await this.departures.getRealtimeForLine(id);

    return this.formatBoard(board, query.format);
  }

  @Get("departures")
  @ApiOperation({
    summary:
      "Scheduled departures for all configured lines, merged with the default realtime source",
  })
  @ApiOkResponse({ schema: BOARD_OR_AWTRIX_LIST })
  @ApiNotFoundResponse({ description: "No board departing from ?from=" })
  async departuresAll(
    @Query() query: DeparturesAllQueryDto,
  ): Promise<(DeparturesResponse | AwtrixResponse)[]> {
    const dateFrom = this.parseDateFrom(query.dateFrom);

    const boards = await this.departures.fetchAllLines(
      dateFrom,
      this.departures.resolveFetchType(),
      query.from,
    );

    return this.formatBoards(boards, query.format);
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
  @ApiOkResponse({ schema: BOARD_OR_AWTRIX })
  @ApiNotFoundResponse({ description: "Line not found" })
  async departuresById(
    @Param("id", ParseIntPipe) id: number,
    @Query() query: DeparturesByIdQueryDto,
    @Param("typeFetch") typeFetch?: string,
  ): Promise<DeparturesResponse | AwtrixResponse> {
    const lineData = this.departures.findLineData(id);
    const dateFrom = this.parseDateFrom(query.dateFrom);

    const board = await this.departures.fetchLine(
      lineData,
      dateFrom,
      this.departures.resolveFetchType(typeFetch),
    );

    return this.formatBoard(board, query.format);
  }

  @Get("departuresPrim/:id")
  @ApiOperation({ summary: "Realtime departures from the PRIM SIRI Lite API" })
  @ApiParam({ name: "id", type: Number, description: "PRIM line id" })
  @ApiOkResponse({ schema: BOARD_OR_AWTRIX })
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

    return this.formatBoard(departuresRes, query.format);
  }

  @Get("departuresPrimByType/:type")
  @ApiOperation({
    summary: "Realtime PRIM departures for every line of a given type",
  })
  @ApiParam({ name: "type", type: String, example: "TER" })
  @ApiOkResponse({ schema: BOARD_OR_AWTRIX_LIST })
  @ApiNotFoundResponse({ description: "Prim data not found" })
  @ApiServiceUnavailableResponse({ description: "PRIM API not configured" })
  async departuresPrimByType(
    @Param("type") type: string,
    @Query() query: ListQueryDto,
  ): Promise<(DeparturesResponse | AwtrixResponse)[]> {
    const boards = await this.departures.getPrimDeparturesByType(
      type,
      query.from,
    );

    return this.formatBoards(boards, query.format);
  }

  @Get("departuresSiri/:id")
  @ApiOperation({
    summary:
      "Realtime departures from the national SIRI ET feed (delays + platforms, RER C and TER/Rémi)",
  })
  @ApiParam({ name: "id", type: Number, description: "Siri board id" })
  @ApiOkResponse({ schema: BOARD_OR_AWTRIX })
  @ApiNotFoundResponse({ description: "Siri board not found" })
  @ApiServiceUnavailableResponse({
    description: "SIRI ET feed could not be fetched",
  })
  async departuresSiri(
    @Param("id", ParseIntPipe) id: number,
    @Query() query: FormatQueryDto,
  ): Promise<DeparturesResponse | AwtrixResponse> {
    const departuresRes = await this.departures.getSiriBoard(id);

    return this.formatBoard(departuresRes, query.format);
  }

  @Get("departuresSiriByType/:type")
  @ApiOperation({
    summary: "SIRI ET departures for every board of a given type",
  })
  @ApiParam({ name: "type", type: String, example: "train" })
  @ApiOkResponse({ schema: BOARD_OR_AWTRIX_LIST })
  @ApiNotFoundResponse({ description: "Siri board not found" })
  @ApiServiceUnavailableResponse({
    description: "SIRI ET feed could not be fetched",
  })
  async departuresSiriByType(
    @Param("type") type: string,
    @Query() query: ListQueryDto,
  ): Promise<(DeparturesResponse | AwtrixResponse)[]> {
    const boards = await this.departures.getSiriBoardsByType(type, query.from);

    return this.formatBoards(boards, query.format);
  }

  @Get("departuresCrawl/:id")
  @ApiOperation({
    summary: "Departures scraped from the ter.sncf.com schedule page",
  })
  @ApiParam({ name: "id", type: Number, description: "Line id" })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(CrawlResponseDto) },
        { $ref: getSchemaPath(AwtrixResponseDto) },
      ],
    },
  })
  @ApiNotFoundResponse({ description: "Line not found" })
  @ApiServiceUnavailableResponse({ description: "Crawl not configured" })
  async departuresCrawl(
    @Param("id", ParseIntPipe) id: number,
    @Query() query: FormatQueryDto,
  ): Promise<IsCached<CrawlRes[]> | AwtrixResponse> {
    if (query.format === "awtrix") {
      return this.departures.toAwtrix(
        await this.departures.getCrawlDeparturesBoard(id),
      );
    }

    return this.departures.getCrawlDepartures(id);
  }

  @Get("departuresCrawlFlare")
  @ApiOperation({
    summary:
      "Departures crawled through FlareSolverr for all configured stations",
  })
  @ApiOkResponse({ schema: BOARD_OR_AWTRIX_LIST })
  @ApiNotFoundResponse({ description: "No board departing from ?from=" })
  @ApiServiceUnavailableResponse({
    description: "FlareSolverr crawl not configured",
  })
  async departuresCrawlFlareAll(
    @Query() query: CrawlFlareListQueryDto,
  ): Promise<(DeparturesResponse | AwtrixResponse)[]> {
    const boards = await this.departures.getAllCrawlFlareDepartures(
      query.type,
      query.from,
    );

    return this.formatBoards(boards, query.format);
  }

  @Get("departuresCrawlFlare/:id")
  @ApiOperation({
    summary: "Departures crawled through FlareSolverr for one station",
  })
  @ApiParam({ name: "id", type: Number, description: "Crawl data id" })
  @ApiOkResponse({ schema: BOARD_OR_AWTRIX })
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

    return this.formatBoard(departuresRes, query.format);
  }
}
