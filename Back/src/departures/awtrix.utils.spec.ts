import { afterEach, describe, expect, it, setSystemTime } from "bun:test";

import type { DeparturesResponse } from "../types/Response";
import formatDeparturesAwtrix, { AwtrixIcons } from "./awtrix.utils";

const icons: AwtrixIcons = { iconTer: "ter-icon", iconRer: "rer-icon" };

function makeResponse(
  data: DeparturesResponse["data"],
): DeparturesResponse {
  return { title: "Étampes - 23/07", data, isCached: false, fetchType: "prim" };
}

afterEach(() => {
  setSystemTime();
});

describe("formatDeparturesAwtrix", () => {
  it("returns a red 'No trains' frame when there is no data", () => {
    const result = formatDeparturesAwtrix(makeResponse([]), icons);

    expect(result).toEqual({
      icon: icons.iconTer,
      color: "#FF0000",
      pos: 1,
      text: "No trains",
    });
  });

  it("picks a train inside the 20-80 minute window", () => {
    setSystemTime(new Date("2026-07-23T14:00:00"));

    const result = formatDeparturesAwtrix(
      makeResponse([
        { title: "A", departureTime: "14:10" }, // too soon
        { title: "B", departureTime: "14:35", trainType: "RER" },
      ]),
      icons,
    );

    expect(result.text).toBe("14:35");
    expect(result.icon).toBe(icons.iconRer);
    expect(result.color).toBe("#FFFFFF");
  });

  it("prefers a TER inside the window", () => {
    setSystemTime(new Date("2026-07-23T14:00:00"));

    const result = formatDeparturesAwtrix(
      makeResponse([
        { title: "A", departureTime: "14:30", trainType: "RER" },
        { title: "B", departureTime: "15:00", trainType: "TER" },
      ]),
      icons,
    );

    expect(result.text).toBe("15:00");
    expect(result.icon).toBe(icons.iconTer);
  });

  it("skips cancelled trains and shows delays in red", () => {
    setSystemTime(new Date("2026-07-23T14:00:00"));

    const result = formatDeparturesAwtrix(
      makeResponse([
        { title: "A", departureTime: "14:30", deleted: true },
        { title: "B", departureTime: "14:40", delay: 5 },
      ]),
      icons,
    );

    expect(result.text).toBe("14:40");
    expect(result.color).toBe("#FF0000");
  });

  it("falls back to the first departure when nothing is in the window", () => {
    setSystemTime(new Date("2026-07-23T14:00:00"));

    const result = formatDeparturesAwtrix(
      makeResponse([{ title: "A", departureTime: "14:05" }]),
      icons,
    );

    expect(result.text).toBe("14:05");
  });

  it("handles departures just after midnight (§2.4)", () => {
    setSystemTime(new Date("2026-07-23T23:50:00"));

    const result = formatDeparturesAwtrix(
      makeResponse([
        { title: "A", departureTime: "23:55" }, // 5 min -> out of window
        { title: "B", departureTime: "00:20" }, // 30 min past midnight
      ]),
      icons,
    );

    expect(result.text).toBe("00:20");
  });
});
