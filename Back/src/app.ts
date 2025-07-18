import dotenv from "dotenv";
import express from "express";

import linesData from "./conf/lines-data";
import {
  fetchDataFromLineData,
  fetchDataFromLinesData,
  getDateFromQuery,
  getDefaultFetchRTMethod,
  isRTFetchType,
} from "./utils/utils";
import {
  getDeparturesFromToRealtime,
  getDeparturesFromLineDataRealtime,
} from "./utils/utilsRT";
import { SNCF } from "./services/sncf-api";
import { readGtfsRT } from "./services/gtfs-api";
import primsData from "./conf/prim-data";
import { getDeparturesFromPrim } from "./utils/utilsPrim";
import { Crawl } from "./services/crawl-api";
import { DeparturesResponse, TrainResponse } from "./types/Response";
import { CrawlFlare } from "./services/crawl-flare-api";
import crawlsData from "./conf/crawl-data";
import { parseCrawlFlareDeparturesWithTitle } from "./utils/utilsFlare";
import { TrainType } from "./types/CrawlFlareDeparture";
import { QUERY_FORMAT, QueryType } from "./types/QueryTypes";
import formatDeparturesAwtrix, { AwtrixResponse } from "./utils/utilsAwtrix";

dotenv.config();

const app = express();
const port = process.env.PORT || 80;

// we add global middleware to log all url called
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get("/departuresRT", async (req, res) => {
  try {
    const feed = await readGtfsRT();

    if (!feed) {
      res.status(503);
      res.send("Error while fetching GTFS RT");
      return;
    }

    const departuresFrom = await getDeparturesFromToRealtime(
      linesData[0],
      linesData[1],
      feed
    );
    const departuresTo = await getDeparturesFromToRealtime(
      linesData[1],
      linesData[0],
      feed
    );

    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify([departuresFrom, departuresTo]));
  } catch (e) {
    res.status(503);
    res.send("Error while fetching GTFS RT");
    console.error(e);
    return;
  }
});

app.get("/departuresRT/:id", async (req, res) => {
  const { id } = req.params;
  const lineData = linesData.find((line) => line.id === Number(id));

  if (!lineData || !lineData.gtfsId) {
    res.status(404);
    res.send("Line not found");
    return;
  }

  let departures: {
    title: string;
    data: TrainResponse[];
    isCached: boolean;
  };

  const feed = await readGtfsRT();

  if (!feed) {
    res.status(503);
    res.send("Error while fetching GTFS RT");
    return;
  }

  if (lineData.gtfsIdTo) {
    const lineDataTo = linesData.filter(
      (line) => line.gtfsId === lineData.gtfsIdTo
    )[0];
    departures = await getDeparturesFromToRealtime(lineData, lineDataTo, feed);
  } else {
    departures = await getDeparturesFromLineDataRealtime(lineData, feed);
  }

  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(departures));
});

app.get("/departures/", async (req, res) => {
  const dateFrom = getDateFromQuery(req.query.dateFrom as string | undefined);

  if (!dateFrom) {
    res.status(400);
    res.send("Invalid dateFrom parameter");
    return;
  }

  const sncf = new SNCF(
    process.env.SNCF_API_URL as string,
    process.env.SNCF_API_KEY as string
  );
  const resTimes = await fetchDataFromLinesData(
    sncf,
    linesData,
    dateFrom,
    getDefaultFetchRTMethod()
  );

  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(resTimes));
});

app.get("/departures/:id/:typeFetch?", async (req, res) => {
  const { id, typeFetch } = req.params;
  const lineData = linesData.filter((line) => line.id === Number(id))[0];

  if (!lineData) {
    res.status(404);
    res.send("Line not found");
    return;
  }

  const dateFrom = getDateFromQuery(req.query.dateFrom as string | undefined);

  if (!dateFrom) {
    res.status(400);
    res.send("Invalid dateFrom parameter");
    return;
  }

  const typeFetchMethod = isRTFetchType(typeFetch)
    ? typeFetch
    : getDefaultFetchRTMethod();

  const sncf = new SNCF(
    process.env.SNCF_API_URL as string,
    process.env.SNCF_API_KEY as string
  );
  const resTimes = await fetchDataFromLineData(
    sncf,
    lineData,
    dateFrom,
    typeFetchMethod
  );

  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(resTimes));
});

app.get("/departuresPrim/:id", async (req, res) => {
  const { id } = req.params;
  const { format } = req.query;
  const primData = primsData.find((line) => line.id === Number(id));
  const formatType: QueryType = QUERY_FORMAT.includes(format as QueryType)
    ? (format as QueryType)
    : "json";

  if (!primData) {
    res.status(404);
    res.send("Prim data not found");
    return;
  }

  const departuresRes = await getDeparturesFromPrim(primData);

  if (departuresRes === false) {
    res.status(404);
    res.send();
    return;
  }

  if (formatType === "awtrix") {
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(formatDeparturesAwtrix(departuresRes)));
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(departuresRes));
});

app.get("/departuresPrimByType/:type", async (req, res) => {
  const { type } = req.params;
  const primData = primsData.filter((line) => line.type === type);

  if (!primData.length) {
    res.status(404);
    res.send("Prim data not found");
    return;
  }

  const settledRes = await Promise.allSettled(
    primData.map(async (prim) => getDeparturesFromPrim(prim))
  );

  const departuresRes = settledRes.reduce(
    (acc: DeparturesResponse[], settled) => {
      if (settled.status === "fulfilled" && settled.value !== false) {
        acc.push(settled.value);
      }

      return acc;
    },
    []
  );

  if (!departuresRes.length) {
    res.status(404);
    res.send();
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(departuresRes));
});

app.get("/departuresCrawl/:id", async (req, res) => {
  const { id } = req.params;
  const lineData = linesData.filter((line) => line.id === Number(id))[0];

  if (!lineData) {
    res.status(404);
    res.send("Line not found");
    return;
  }

  const crawl = new Crawl(process.env.SNCF_CRAWL_URL as string);

  const crawlRes = await crawl.getDepartures(lineData);

  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(crawlRes));
});

app.get("/departuresCrawlFlare/:id", async (req, res) => {
  const { id } = req.params;
  const { type, format } = req.query;
  const crawlData = crawlsData.filter((data) => data.id === Number(id))[0];
  const formatType: QueryType = QUERY_FORMAT.includes(format as QueryType)
    ? (format as QueryType)
    : "json";

  if (!crawlData) {
    res.status(404);
    res.send("Crawl data not found");
    return;
  }
  if (type && !Object.values(TrainType).includes(type as TrainType)) {
    res.status(404);
    res.send("Train type not found");
    return;
  }

  const crawlFlare = new CrawlFlare(
    process.env.FLARE_API_URL as string,
    process.env.SNCF_CRAWL_FLARE_URL as string
  );

  const departures = await crawlFlare.getDepartures(crawlData);

  console.log("departures", departures, crawlData);

  const departuresRes = parseCrawlFlareDeparturesWithTitle(
    crawlData,
    departures,
    type as TrainType
  );

  if (formatType === "awtrix") {
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(formatDeparturesAwtrix(departuresRes)));
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(departuresRes));
});

app.get("/departuresCrawlFlare", async (req, res) => {
  const { type, format } = req.query;
  const formatType: QueryType = QUERY_FORMAT.includes(format as QueryType)
    ? (format as QueryType)
    : "json";

  if (type && !Object.values(TrainType).includes(type as TrainType)) {
    res.status(404);
    res.send("Train type not found");
    return;
  }

  const finalRes = await Promise.all(
    crawlsData.map(
      async (crawlData): Promise<DeparturesResponse | AwtrixResponse> => {
        const crawlFlare = new CrawlFlare(
          process.env.FLARE_API_URL as string,
          process.env.SNCF_CRAWL_FLARE_URL as string
        );

        const departures = await crawlFlare.getDepartures(crawlData);

        const departuresRes = parseCrawlFlareDeparturesWithTitle(
          crawlData,
          departures,
          type as TrainType
        );

        if (formatType === "awtrix") {
          return formatDeparturesAwtrix(departuresRes);
        }

        return departuresRes;
      }
    )
  );

  if (!finalRes.length) {
    res.status(404);
    res.send("Crawl data not found");
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(finalRes));
});

app.listen(port, () => {
  console.log(`Express is listening at http://localhost:${port}`);
});
