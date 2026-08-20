import "reflect-metadata";

import { beforeAll, describe, expect, it } from "bun:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import type { DeparturesResponse } from "../types/Response";
import { DeparturesController } from "./departures.controller";
import { DeparturesService } from "./departures.service";

const sampleResponse: DeparturesResponse = {
  title: "Étampes - 23/07",
  data: [{ title: "Austerlitz", departureTime: "12:00", delay: 2 }],
  isCached: false,
  fetchType: "prim",
};

const awtrixFrame = { icon: "1", color: "#FF0000", pos: 1, text: "12:00" };

const serviceStub = {
  findLineData: (id: number) => {
    if (id !== 1) throw new NotFoundException("Line not found");
    return { id: 1 };
  },
  findPrimData: (id: number) => {
    if (id !== 1) throw new NotFoundException("Prim data not found");
    return { id: 1 };
  },
  resolveFetchType: (type?: string) =>
    type === "prim" || type === "gtfs" ? type : "crawlFlare",
  fetchLine: async (_line: unknown, _date: Date, type: string) => ({
    ...sampleResponse,
    fetchType: type,
  }),
  getPrimDepartures: async () => sampleResponse,
  getSiriBoardsByType: async (_type: string, from?: string) =>
    from ? [sampleResponse] : [sampleResponse, sampleResponse],
  getCrawlDepartures: async () => ({ isCached: false, data: [] }),
  getCrawlDeparturesBoard: async () => sampleResponse,
  toAwtrix: () => awtrixFrame,
};

describe("DeparturesController", () => {
  let controller: DeparturesController;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DeparturesController],
      providers: [{ provide: DeparturesService, useValue: serviceStub }],
    }).compile();

    controller = moduleRef.get(DeparturesController);
  });

  it("resolves the typeFetch route param", async () => {
    const result = (await controller.departuresById(
      1,
      {},
      "prim",
    )) as DeparturesResponse;

    expect(result.fetchType).toBe("prim");
  });

  it("falls back to the default fetch type for unknown typeFetch values", async () => {
    const result = (await controller.departuresById(
      1,
      {},
      "bogus",
    )) as DeparturesResponse;

    expect(result.fetchType).toBe("crawlFlare");
  });

  it("rejects an invalid dateFrom with a 400", () => {
    expect(
      controller.departuresById(1, { dateFrom: "notadate" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("propagates 404 for unknown lines", () => {
    expect(controller.departuresById(42, {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it("returns JSON by default and an awtrix frame when format=awtrix", async () => {
    const json = await controller.departuresPrim(1, {});
    const awtrix = await controller.departuresPrim(1, { format: "awtrix" });

    expect(json).toEqual(sampleResponse);
    expect(awtrix).toEqual(awtrixFrame);
  });

  it("supports format=awtrix on the merged /departures/:id route", async () => {
    const awtrix = await controller.departuresById(1, { format: "awtrix" });

    expect(awtrix).toEqual(awtrixFrame);
  });

  it("passes ?from= through and maps each board when format=awtrix", async () => {
    const all = await controller.departuresSiriByType("train", {});
    const one = await controller.departuresSiriByType("train", {
      from: "etampes",
    });
    const awtrix = await controller.departuresSiriByType("train", {
      format: "awtrix",
    });

    expect(all).toHaveLength(2);
    expect(one).toHaveLength(1);
    expect(awtrix).toEqual([awtrixFrame, awtrixFrame]);
  });

  it("converts the raw crawl to an awtrix frame when format=awtrix", async () => {
    const json = await controller.departuresCrawl(1, {});
    const awtrix = await controller.departuresCrawl(1, { format: "awtrix" });

    expect(json).toEqual({ isCached: false, data: [] });
    expect(awtrix).toEqual(awtrixFrame);
  });
});
