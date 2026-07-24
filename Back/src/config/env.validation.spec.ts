import { describe, expect, it } from "bun:test";

import { validateEnv } from "./env.validation";

const validMinimalEnv = {
  REDIS_URL: "redis://localhost:6379",
  SNCF_API_URL: "https://api.sncf.com/v1",
  SNCF_API_KEY: "some-key",
  SNCF_GTFSRT_URL: "https://example.com/feed",
};

describe("validateEnv", () => {
  it("accepts a minimal valid configuration", () => {
    const result = validateEnv(validMinimalEnv);

    expect(result.REDIS_URL).toBe(validMinimalEnv.REDIS_URL);
    expect(result.PORT).toBeUndefined();
  });

  it("fails fast when a required variable is missing", () => {
    const { REDIS_URL: _omitted, ...withoutRedis } = validMinimalEnv;

    expect(() => validateEnv(withoutRedis)).toThrow(
      /Invalid environment configuration/,
    );
  });

  it("coerces PORT to a number", () => {
    const result = validateEnv({ ...validMinimalEnv, PORT: "8080" });

    expect(result.PORT).toBe(8080);
  });

  it("rejects an unknown DEFAULT_FETCH_RT_METHOD", () => {
    expect(() =>
      validateEnv({ ...validMinimalEnv, DEFAULT_FETCH_RT_METHOD: "bogus" }),
    ).toThrow(/Invalid environment configuration/);
  });

  it("treats empty strings as unset (docker-compose passthrough)", () => {
    const result = validateEnv({
      ...validMinimalEnv,
      DEFAULT_FETCH_RT_METHOD: "",
      REDIS_CRAWL_EXPIRE: "",
      SNCF_API_PRIM_URL: "",
    });

    expect(result.DEFAULT_FETCH_RT_METHOD).toBeUndefined();
    expect(result.REDIS_CRAWL_EXPIRE).toBeUndefined();
    expect(result.SNCF_API_PRIM_URL).toBeUndefined();
  });

  it("rejects a required variable set to an empty string", () => {
    expect(() =>
      validateEnv({ ...validMinimalEnv, SNCF_API_KEY: "" }),
    ).toThrow(/Invalid environment configuration/);
  });

  it("accepts a valid DEFAULT_FETCH_RT_METHOD", () => {
    const result = validateEnv({
      ...validMinimalEnv,
      DEFAULT_FETCH_RT_METHOD: "prim",
    });

    expect(result.DEFAULT_FETCH_RT_METHOD).toBe("prim");
  });
});
