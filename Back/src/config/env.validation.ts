import { z } from "zod";

export const RT_FETCH_TYPES = ["gtfs", "prim", "crawlFlare"] as const;

/** Ordered from least to most verbose. */
export const LOG_LEVELS = ["error", "warn", "log", "debug", "verbose"] as const;
export type AppLogLevel = (typeof LOG_LEVELS)[number];

/**
 * Required vars fail the boot (fail fast, §2.2 of the optimization report).
 * Feature-specific vars are optional: the endpoints that need them return
 * 503 with an explicit message when they are missing.
 */
export const envSchema = z.object({
  PORT: z.coerce.number().int().min(0).optional(),

  REDIS_URL: z.string(),
  SNCF_API_URL: z.string().min(1),
  SNCF_API_KEY: z.string().min(1),
  SNCF_GTFSRT_URL: z.string().min(1),

  SNCF_API_PRIM_URL: z.string().optional(),
  SNCF_API_PRIM_KEY: z.string().optional(),
  SNCF_CRAWL_URL: z.string().optional(),
  FLARE_API_URL: z.string().optional(),
  SNCF_CRAWL_FLARE_URL: z.string().optional(),

  REDIS_CRAWL_EXPIRE: z.coerce.number().int().positive().optional(),
  DEFAULT_FETCH_RT_METHOD: z.enum(RT_FETCH_TYPES).optional(),

  AWTRIX_ICON_TER: z.string().optional(),
  AWTRIX_ICON_RER: z.string().optional(),

  LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
});

export type EnvironmentVariables = z.infer<typeof envSchema>;

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  // Empty strings count as unset: docker-compose passes optional vars
  // through as "" when they are not defined in .env.
  const cleaned = Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== ""),
  );

  const result = envSchema.safeParse(cleaned);

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
