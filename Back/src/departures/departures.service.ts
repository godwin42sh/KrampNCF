import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { format } from "date-fns";

import crawlsData from "../config/crawl-data";
import { RT_FETCH_TYPES } from "../config/env.validation";
import linesData from "../config/lines-data";
import primsData from "../config/prim-data";
import { CrawlFlareService } from "../crawl/crawl-flare.service";
import { CrawlService } from "../crawl/crawl.service";
import { GtfsService } from "../gtfs/gtfs.service";
import { PrimService } from "../prim/prim.service";
import { SncfService } from "../sncf/sncf.service";
import type { CrawlFlareDeparture } from "../types/CrawlFlareDeparture";
import type { TrainType } from "../types/CrawlFlareDeparture";
import type { CrawlRes } from "../types/CrawlRes";
import type { IsCached } from "../types/IsCached";
import type { LineData } from "../types/LineData";
import type { PrimData } from "../types/PrimData";
import type { DeparturesResponse } from "../types/Response";
import type { RTFetchType } from "../types/RTFetchType";
import formatDeparturesAwtrix, {
  AwtrixIcons,
  AwtrixResponse,
} from "./awtrix.utils";
import {
  addDockToTrainResponses,
  filterScheduledDepartures,
  parseScheduledData,
} from "./departures.utils";
import {
  getDeparturesFromLineDataRealtime,
  getDeparturesFromToRealtime,
  getDeparturesTimeWithDelayFromTimeUpdates,
  getDeparturesTimesWithDelayFromFeed,
} from "./gtfs-rt.utils";
import {
  mergeCrawlFlareWithScheduledData,
  parseCrawlFlareDeparturesWithTitle,
} from "./flare.utils";
import {
  getDeparturesFromScheduledAndPrim,
  parsePrimDeliveries,
} from "./prim.utils";

@Injectable()
export class DeparturesService {
  private readonly logger = new Logger(DeparturesService.name);
  private readonly awtrixIcons: AwtrixIcons;
  private readonly defaultFetchMethod: RTFetchType;

  constructor(
    config: ConfigService,
    private readonly sncf: SncfService,
    private readonly gtfs: GtfsService,
    private readonly prim: PrimService,
    private readonly crawl: CrawlService,
    private readonly crawlFlare: CrawlFlareService,
  ) {
    this.awtrixIcons = {
      iconTer: config.get<string>("AWTRIX_ICON_TER") ?? "59998",
      iconRer: config.get<string>("AWTRIX_ICON_RER") ?? "59997",
    };
    this.defaultFetchMethod =
      config.get<RTFetchType>("DEFAULT_FETCH_RT_METHOD") ?? "crawlFlare";
  }

  // --- lookups ---------------------------------------------------------

  findLineData(id: number): LineData {
    const lineData = linesData.find((line) => line.id === id);

    if (!lineData) {
      throw new NotFoundException("Line not found");
    }

    return lineData;
  }

  findPrimData(id: number): PrimData {
    const primData = primsData.find((line) => line.id === id);

    if (!primData) {
      throw new NotFoundException("Prim data not found");
    }

    return primData;
  }

  resolveFetchType(type?: string): RTFetchType {
    return type && (RT_FETCH_TYPES as readonly string[]).includes(type)
      ? (type as RTFetchType)
      : this.defaultFetchMethod;
  }

  toAwtrix(departuresResponse: DeparturesResponse): AwtrixResponse {
    return formatDeparturesAwtrix(departuresResponse, this.awtrixIcons);
  }

  // --- GTFS realtime ---------------------------------------------------

  private async getFeedOrThrow() {
    const feedRes = await this.gtfs.getFeed();

    if (!feedRes) {
      throw new ServiceUnavailableException("Error while fetching GTFS RT");
    }

    return feedRes;
  }

  async getRealtimeBothDirections(): Promise<DeparturesResponse[]> {
    const feedRes = await this.getFeedOrThrow();

    const results = [
      getDeparturesFromToRealtime(linesData[0], linesData[1], feedRes),
      getDeparturesFromToRealtime(linesData[1], linesData[0], feedRes),
    ];

    this.logger.debug(
      `realtime both directions: ${results.map((r) => `${r.title}=${r.data.length}`).join(", ")}` +
        `${feedRes.isCached ? " (cached feed)" : ""}`,
    );

    return results;
  }

  async getRealtimeForLine(id: number): Promise<DeparturesResponse> {
    const lineData = this.findLineData(id);

    if (!lineData.gtfsId) {
      throw new NotFoundException("Line not found");
    }

    const feedRes = await this.getFeedOrThrow();

    if (lineData.gtfsIdTo) {
      const lineDataTo = linesData.find(
        (line) => line.gtfsId === lineData.gtfsIdTo,
      );

      if (lineDataTo) {
        const result = getDeparturesFromToRealtime(
          lineData,
          lineDataTo,
          feedRes,
        );
        this.logger.debug(
          `realtime line=${lineData.id} (from-to): ${result.data.length} trains`,
        );
        return result;
      }
    }

    const result = getDeparturesFromLineDataRealtime(lineData, feedRes);
    this.logger.debug(
      `realtime line=${lineData.id}: ${result.data.length} trains`,
    );
    return result;
  }

  // --- scheduled + realtime merge flows -------------------------------

  private makeResponseScaffold(
    lineData: LineData,
    dateFrom: Date,
    fetchType: RTFetchType,
    isCached: boolean,
  ): DeparturesResponse {
    return {
      title: `${lineData.title} - ${format(dateFrom, "dd/MM")}`,
      data: [],
      isCached,
      fetchType,
    };
  }

  /**
   * The scheduled departures, the realtime source and the dock crawl are
   * independent — they are fetched concurrently instead of sequentially
   * (§1.3 of the optimization report).
   */
  private async fetchLineGtfs(
    lineData: LineData,
    dateFrom: Date,
  ): Promise<DeparturesResponse> {
    const [scheduled, feedRes, crawlDocks] = await Promise.all([
      this.sncf.getDepartures(
        lineData.stopAreaId,
        dateFrom,
        lineData.stopFilters,
      ),
      this.gtfs.getFeed(),
      this.crawl.getDeparturesSafe(lineData),
    ]);

    this.logger.debug(
      `gtfs flow line=${lineData.id}: scheduled=${scheduled.data.length}` +
        `${scheduled.isCached ? " (cached)" : ""}, feed=${feedRes ? "ok" : "unavailable"}, docks=${crawlDocks.length}`,
    );

    const res = this.makeResponseScaffold(
      lineData,
      dateFrom,
      "gtfs",
      scheduled.isCached,
    );
    const departures = filterScheduledDepartures(
      lineData,
      dateFrom,
      scheduled.data,
    );

    if (!departures.length || !feedRes) {
      this.logger.debug(
        `gtfs flow line=${lineData.id}: returning empty (filtered=${departures.length}, feed=${feedRes ? "ok" : "unavailable"})`,
      );
      return res;
    }

    const tripsDelayed = getDeparturesTimesWithDelayFromFeed(
      feedRes.data,
      lineData.gtfsId,
    );

    const resTimes = departures.map((departure) =>
      getDeparturesTimeWithDelayFromTimeUpdates(
        lineData,
        tripsDelayed,
        departure,
      ),
    );

    this.logger.debug(
      `gtfs flow line=${lineData.id}: filtered=${departures.length}, delayed stop updates=${tripsDelayed.length} -> ${resTimes.length} trains`,
    );

    return {
      ...res,
      data: addDockToTrainResponses(resTimes, crawlDocks),
    };
  }

  private async fetchLinePrim(
    lineData: LineData,
    dateFrom: Date,
  ): Promise<DeparturesResponse> {
    const primData = primsData.find((data) => data.id === lineData.primDataId);

    const [scheduled, primRes, crawlDocks] = await Promise.all([
      this.sncf.getDepartures(
        lineData.stopAreaId,
        dateFrom,
        lineData.stopFilters,
      ),
      primData
        ? this.prim.getDepartures(primData).catch(() => null)
        : Promise.resolve(null),
      this.crawl.getDeparturesSafe(lineData),
    ]);

    this.logger.debug(
      `prim flow line=${lineData.id}: scheduled=${scheduled.data.length}` +
        `${scheduled.isCached ? " (cached)" : ""}, prim=${primRes ? `${primRes.data.length} deliveries` : "unavailable"}, docks=${crawlDocks.length}`,
    );

    const res = this.makeResponseScaffold(
      lineData,
      dateFrom,
      "prim",
      scheduled.isCached,
    );
    const departures = filterScheduledDepartures(
      lineData,
      dateFrom,
      scheduled.data,
    );

    if (!departures.length || !primRes) {
      this.logger.debug(
        `prim flow line=${lineData.id}: returning empty (filtered=${departures.length}, prim=${primRes ? "ok" : "unavailable"})`,
      );
      return res;
    }

    const visits = primRes.data.flatMap((data) => data.MonitoredStopVisit);

    const resTimes = departures.map((departure) =>
      getDeparturesFromScheduledAndPrim(lineData, departure, visits),
    );

    this.logger.debug(
      `prim flow line=${lineData.id}: filtered=${departures.length}, visits=${visits.length} -> ${resTimes.length} trains`,
    );

    return {
      ...res,
      data: addDockToTrainResponses(resTimes, crawlDocks),
    };
  }

  private async fetchLineCrawlFlare(
    lineData: LineData,
    dateFrom: Date,
  ): Promise<DeparturesResponse> {
    const crawlData = crawlsData.find(
      (crawl) => crawl.id === lineData.crawlDataId,
    );

    const emptyCrawl: IsCached<CrawlFlareDeparture[]> = {
      isCached: false,
      data: [],
    };

    const [scheduled, departuresCrawl] = await Promise.all([
      this.sncf.getDepartures(
        lineData.stopAreaId,
        dateFrom,
        lineData.stopFilters,
      ),
      crawlData
        ? this.crawlFlare.getDepartures(crawlData).catch(() => emptyCrawl)
        : Promise.resolve(emptyCrawl),
    ]);

    this.logger.debug(
      `crawlFlare flow line=${lineData.id}: scheduled=${scheduled.data.length}` +
        `${scheduled.isCached ? " (cached)" : ""}, crawl=${departuresCrawl.data.length} departures`,
    );

    const res = this.makeResponseScaffold(
      lineData,
      dateFrom,
      "crawlFlare",
      scheduled.isCached,
    );
    const departures = filterScheduledDepartures(
      lineData,
      dateFrom,
      scheduled.data,
    );

    if (!departures.length || !crawlData) {
      this.logger.debug(
        `crawlFlare flow line=${lineData.id}: returning empty (filtered=${departures.length}, crawlData=${crawlData ? "ok" : "missing"})`,
      );
      return res;
    }

    const resTimesScheduled = parseScheduledData(lineData, departures);
    const merged = mergeCrawlFlareWithScheduledData(
      resTimesScheduled,
      departuresCrawl.data,
      crawlData,
    );

    this.logger.debug(
      `crawlFlare flow line=${lineData.id}: filtered=${departures.length} -> ${merged.length} trains`,
    );

    return {
      ...res,
      data: merged,
    };
  }

  async fetchLine(
    lineData: LineData,
    dateFrom: Date,
    type: RTFetchType,
  ): Promise<DeparturesResponse> {
    const funcByType: Record<
      RTFetchType,
      (lineData: LineData, dateFrom: Date) => Promise<DeparturesResponse>
    > = {
      gtfs: (line, date) => this.fetchLineGtfs(line, date),
      prim: (line, date) => this.fetchLinePrim(line, date),
      crawlFlare: (line, date) => this.fetchLineCrawlFlare(line, date),
    };

    return funcByType[type](lineData, dateFrom);
  }

  async fetchAllLines(
    dateFrom: Date,
    type: RTFetchType,
  ): Promise<DeparturesResponse[]> {
    const settled = await Promise.allSettled(
      linesData.map((lineData) => this.fetchLine(lineData, dateFrom, type)),
    );

    return settled
      .filter(
        (res): res is PromiseFulfilledResult<DeparturesResponse> =>
          res.status === "fulfilled",
      )
      .map((res) => res.value);
  }

  // --- PRIM ------------------------------------------------------------

  async getPrimDepartures(
    primData: PrimData,
  ): Promise<DeparturesResponse | false> {
    const deliveries = await this.prim.getDepartures(primData);

    return parsePrimDeliveries(primData, deliveries);
  }

  async getPrimDeparturesByType(type: string): Promise<DeparturesResponse[]> {
    const primData = primsData.filter((line) => line.type === type);

    if (!primData.length) {
      throw new NotFoundException("Prim data not found");
    }

    const settled = await Promise.allSettled(
      primData.map((prim) => this.getPrimDepartures(prim)),
    );

    const departures = settled.reduce((acc: DeparturesResponse[], res) => {
      if (res.status === "fulfilled" && res.value !== false) {
        acc.push(res.value);
      }
      return acc;
    }, []);

    if (!departures.length) {
      throw new NotFoundException();
    }

    return departures;
  }

  // --- crawls ----------------------------------------------------------

  async getCrawlDepartures(id: number): Promise<IsCached<CrawlRes[]>> {
    return this.crawl.getDepartures(this.findLineData(id));
  }

  async getCrawlFlareDepartures(
    id: number,
    trainType?: TrainType,
  ): Promise<DeparturesResponse> {
    const crawlData = crawlsData.find((data) => data.id === id);

    if (!crawlData) {
      throw new NotFoundException("Crawl data not found");
    }

    const departures = await this.crawlFlare.getDepartures(crawlData);

    return parseCrawlFlareDeparturesWithTitle(crawlData, departures, trainType);
  }

  async getAllCrawlFlareDepartures(
    trainType?: TrainType,
  ): Promise<DeparturesResponse[]> {
    return Promise.all(
      crawlsData.map(async (crawlData) => {
        const departures = await this.crawlFlare.getDepartures(crawlData);

        return parseCrawlFlareDeparturesWithTitle(
          crawlData,
          departures,
          trainType,
        );
      }),
    );
  }
}
