import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { RT_FETCH_TYPES } from "../../config/env.validation";
import { TrainType } from "../../types/CrawlFlareDeparture";
import { QUERY_FORMAT } from "../../types/QueryTypes";

export const trainResponseSchema = z.object({
  title: z.string().meta({ description: "Destination name" }),
  departureTime: z.string().meta({ description: "Departure time (HH:mm)" }),
  arrivalTime: z
    .string()
    .optional()
    .meta({ description: "Arrival time (HH:mm)" }),
  delay: z.number().optional().meta({ description: "Delay in minutes" }),
  deleted: z
    .boolean()
    .optional()
    .meta({ description: "True when the train is cancelled" }),
  trainNumber: z.string().optional(),
  trainType: z.string().optional().meta({ description: "TER, RER, ..." }),
  dock: z.string().optional().meta({ description: "Platform/track" }),
});

export const departuresResponseSchema = z.object({
  title: z.string(),
  data: z.array(trainResponseSchema),
  fetchType: z.enum([...RT_FETCH_TYPES, "siri", "crawl"]),
  isCached: z
    .boolean()
    .meta({ description: "True when served from the Redis/in-memory cache" }),
});

export const crawlResponseSchema = z.object({
  isCached: z.boolean(),
  data: z.array(
    z.object({
      dock: z.string().meta({ description: "Platform/track" }),
      trainNumber: z.string(),
      departureTime: z.string().meta({ description: "Departure time (HH:mm)" }),
    }),
  ),
});

export const awtrixResponseSchema = z.object({
  icon: z.string().meta({ description: "Awtrix icon id" }),
  color: z.string().meta({ description: "Text color (hex)" }),
  pos: z.number(),
  text: z.string().meta({ description: "Displayed text (departure time)" }),
});

export class TrainResponseDto extends createZodDto(trainResponseSchema) {}
export class DeparturesResponseDto extends createZodDto(
  departuresResponseSchema,
) {}
export class CrawlResponseDto extends createZodDto(crawlResponseSchema) {}
export class AwtrixResponseDto extends createZodDto(awtrixResponseSchema) {}

const dateFromField = z
  .string()
  .optional()
  .meta({
    description:
      "Start of the departures window (ISO 8601). Defaults to one hour ago.",
  });

const fromField = z
  .string()
  .optional()
  .meta({
    description:
      "Only boards departing from this station (case- and accent-insensitive, " +
      'e.g. "etampes" or "austerlitz")',
  });

export const formatQuerySchema = z.object({
  format: z
    .enum(QUERY_FORMAT)
    .optional()
    .meta({ description: "Response format, defaults to json" }),
});

/** List routes: pick one departure station out of the returned boards. */
export const listQuerySchema = formatQuerySchema.extend({ from: fromField });

export const departuresByIdQuerySchema = formatQuerySchema.extend({
  dateFrom: dateFromField,
});

export const departuresAllQuerySchema = departuresByIdQuerySchema.extend({
  from: fromField,
});

export const crawlFlareQuerySchema = formatQuerySchema.extend({
  type: z
    .enum(TrainType)
    .optional()
    .meta({ description: "Filter departures by train type" }),
});

export const crawlFlareListQuerySchema = crawlFlareQuerySchema.extend({
  from: fromField,
});

export class FormatQueryDto extends createZodDto(formatQuerySchema) {}
export class ListQueryDto extends createZodDto(listQuerySchema) {}
export class DeparturesByIdQueryDto extends createZodDto(
  departuresByIdQuerySchema,
) {}
export class DeparturesAllQueryDto extends createZodDto(
  departuresAllQuerySchema,
) {}
export class CrawlFlareQueryDto extends createZodDto(crawlFlareQuerySchema) {}
export class CrawlFlareListQueryDto extends createZodDto(
  crawlFlareListQuerySchema,
) {}
