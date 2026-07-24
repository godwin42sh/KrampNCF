import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { XMLParser } from "fast-xml-parser";

import siriBoards from "../config/siri-data";
import { CacheService } from "../redis/cache.service";
import type { IsCached } from "../types/IsCached";
import type { SiriCall, SiriJourney } from "../types/SiriEt";

const DEFAULT_FEED_URL =
  "https://proxy.transport.data.gouv.fr/resource/sncf-siri-lite-estimated-timetable";

const REDIS_KEY = "siriET:journeys";
const TTL_SECONDS = 60;
const MEM_TTL_MS = 60_000;

/** Tags that must always parse as arrays even with a single element. */
const ARRAY_TAGS = new Set([
  "EstimatedTimetableDelivery",
  "EstimatedJourneyVersionFrame",
  "EstimatedVehicleJourney",
  "RecordedCall",
  "EstimatedCall",
]);

/**
 * Reader for the national SNCF SIRI ET Lite feed (realtime estimated
 * timetables for every TGV/Intercités/TER, with platforms — keyless, from
 * the transport.data.gouv.fr proxy).
 *
 * The raw feed is a ~15 MB XML covering all of France, so it is parsed once
 * and reduced to the journeys calling at the stops configured in
 * `siri-data.ts`; only that small filtered set is cached (in-process +
 * Redis) — same strategy as the GTFS-RT reader.
 */
@Injectable()
export class SiriEtService {
  private readonly logger = new Logger(SiriEtService.name);
  private readonly url: string;
  private readonly watchedUics: string[];

  private memCache?: { journeys: SiriJourney[]; fetchedAt: number };

  constructor(
    config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.url = config.get<string>("SNCF_SIRI_ET_URL") ?? DEFAULT_FEED_URL;
    this.watchedUics = [
      ...new Set(siriBoards.flatMap((board) => [...board.fromUics, ...board.toUics])),
    ];
  }

  async getJourneys(): Promise<IsCached<SiriJourney[]> | null> {
    if (this.memCache && Date.now() - this.memCache.fetchedAt < MEM_TTL_MS) {
      this.logger.debug(
        `In-memory cache hit (${this.memCache.journeys.length} journeys)`,
      );
      return { isCached: true, data: this.memCache.journeys };
    }

    const cached = await this.cache.getJson<SiriJourney[]>(REDIS_KEY);

    if (cached) {
      this.logger.debug(`Cache hit ${REDIS_KEY} (${cached.length} journeys)`);
      this.memCache = { journeys: cached, fetchedAt: Date.now() };
      return { isCached: true, data: cached };
    }

    this.logger.debug(`Cache miss — fetching SIRI ET feed from ${this.url}`);
    const startedAt = Date.now();

    try {
      const res = await fetch(this.url);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const xml = await res.text();
      const journeys = this.parseFeed(xml);

      this.logger.debug(
        `Parsed ${Math.round(xml.length / 1024)} KB in ${Date.now() - startedAt}ms — ${journeys.length} journeys at watched stops`,
      );

      if (!journeys.length) {
        this.logger.warn("SIRI ET feed contained no journeys at watched stops");
      }

      this.cache.setJson(REDIS_KEY, journeys, TTL_SECONDS);
      this.memCache = { journeys, fetchedAt: Date.now() };

      return { isCached: false, data: journeys };
    } catch (err) {
      this.logger.error(`SIRI ET fetch failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Parse the feed and keep only journeys calling at a watched stop. */
  parseFeed(xml: string): SiriJourney[] {
    const parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      isArray: (name) => ARRAY_TAGS.has(name),
    });

    const doc = parser.parse(xml);
    const deliveries =
      doc?.Siri?.ServiceDelivery?.EstimatedTimetableDelivery ?? [];

    const journeys: SiriJourney[] = [];

    for (const delivery of deliveries) {
      for (const frame of delivery?.EstimatedJourneyVersionFrame ?? []) {
        for (const vj of frame?.EstimatedVehicleJourney ?? []) {
          const calls = [
            ...(vj?.RecordedCalls?.RecordedCall ?? []),
            ...(vj?.EstimatedCalls?.EstimatedCall ?? []),
          ].map((call) => this.parseCall(call));

          if (
            !calls.some((call) =>
              this.watchedUics.some((uic) => call.stopRef.endsWith(uic)),
            )
          ) {
            continue;
          }

          journeys.push({
            trainNumber: extractTrainNumber(
              vj?.FramedVehicleJourneyRef?.DatedVehicleJourneyRef ??
                vj?.DatedVehicleJourneyRef,
            ),
            lineRef: vj?.LineRef ? String(vj.LineRef) : undefined,
            originName: vj?.OriginName ? String(vj.OriginName) : undefined,
            destinationName: vj?.DestinationName
              ? String(vj.DestinationName)
              : undefined,
            cancelled: String(vj?.Cancellation) === "true",
            calls,
          });
        }
      }
    }

    return journeys;
  }

  private parseCall(call: Record<string, unknown>): SiriCall {
    const str = (v: unknown) => (v == null ? undefined : String(v));

    return {
      stopRef: str(call.StopPointRef) ?? "",
      stopName: str(call.StopPointName),
      aimedArrivalTime: str(call.AimedArrivalTime),
      expectedArrivalTime: str(call.ExpectedArrivalTime),
      aimedDepartureTime: str(call.AimedDepartureTime),
      expectedDepartureTime: str(call.ExpectedDepartureTime),
      arrivalPlatform: str(call.ArrivalPlatformName),
      departurePlatform: str(call.DeparturePlatformName),
    };
  }
}

/**
 * The 6-digit SNCF train number is the prefix of the DatedVehicleJourneyRef
 * hash: "FR:VehicleJourney::860589d36696…:LOC" -> "860589".
 */
function extractTrainNumber(ref?: string): string | undefined {
  const match = ref?.match(/::(\d{6})/);
  return match?.[1];
}
