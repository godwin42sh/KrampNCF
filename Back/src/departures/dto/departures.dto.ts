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
  fetchType: z.enum([...RT_FETCH_TYPES, "siri"]),
  isCached: z
    .boolean()
    .meta({ description: "True when served from the Redis/in-memory cache" }),
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
export class AwtrixResponseDto extends createZodDto(awtrixResponseSchema) {}

export const dateFromQuerySchema = z.object({
  dateFrom: z
    .string()
    .optional()
    .meta({
      description:
        "Start of the departures window (ISO 8601). Defaults to one hour ago.",
    }),
});

export const formatQuerySchema = z.object({
  format: z
    .enum(QUERY_FORMAT)
    .optional()
    .meta({ description: "Response format, defaults to json" }),
});

export const crawlFlareQuerySchema = formatQuerySchema.extend({
  type: z
    .enum(TrainType)
    .optional()
    .meta({ description: "Filter departures by train type" }),
});

export class DateFromQueryDto extends createZodDto(dateFromQuerySchema) {}
export class FormatQueryDto extends createZodDto(formatQuerySchema) {}
export class CrawlFlareQueryDto extends createZodDto(crawlFlareQuerySchema) {}
