import dotenv from 'dotenv';
import express from 'express';

import linesData from './conf/lines-data';
import {
  fetchDataFromLineDataPrim,
  fetchDataFromLinesData,
  getDateFromQuery,
} from './utils/utils';
import {
  getDeparturesFromToRealtime,
  getDeparturesFromLineDataRealtime,
} from './utils/utilsRT';
import { SNCF } from './services/sncf-api';
import { readGtfsRT } from './services/gtfs-api';
import primsData from './conf/prim-data';
import { Prim } from './services/prim-api';
import { getDeparturesFromPrim } from './utils/utilsPrim';
import { Crawl } from './services/crawl-api';

dotenv.config();

const app = express();
const port = process.env.PORT || 80;

app.get('/departuresRT', async (req, res) => {
  const feed = await readGtfsRT();
  const departuresFrom = await getDeparturesFromToRealtime(linesData[0], linesData[1], feed);
  const departuresTo = await getDeparturesFromToRealtime(linesData[1], linesData[0], feed);

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(
    [
      departuresFrom,
      departuresTo,
    ],
  ));
});

app.get('/departuresRT/:id', async (req, res) => {
  const { id } = req.params;
  const lineData = linesData.filter((line) => line.id === Number(id))[0];

  if (!lineData || !lineData.gtfsId) {
    res.status(404);
    res.send('Line not found');
    return;
  }

  let departures: {
    title: string;
    data: any[];
    isCached: boolean;
  };
  const feed = await readGtfsRT();

  if (lineData.gtfsIdTo) {
    const lineDataTo = linesData.filter((line) => line.gtfsId === lineData.gtfsIdTo)[0];
    departures = await getDeparturesFromToRealtime(lineData, lineDataTo, feed);
  } else {
    departures = await getDeparturesFromLineDataRealtime(lineData, feed);
  }

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(departures));
});

app.get('/departures/', async (req, res) => {
  const dateFrom = await getDateFromQuery(req.query.dateFrom as string | undefined);

  if (!dateFrom) {
    res.status(400);
    res.send('Invalid dateFrom parameter');
    return;
  }

  const sncf = new SNCF(process.env.SNCF_API_URL as string, process.env.SNCF_API_KEY as string);
  const resTimes = await fetchDataFromLinesData(sncf, linesData, dateFrom, 'prim');

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(resTimes));
});

app.get('/departures/:id', async (req, res) => {
  const { id } = req.params;
  const lineData = linesData.filter((line) => line.id === Number(id))[0];

  if (!lineData) {
    res.status(404);
    res.send('Line not found');
    return;
  }

  const dateFrom = await getDateFromQuery(req.query.dateFrom as string | undefined);

  if (!dateFrom) {
    res.status(400);
    res.send('Invalid dateFrom parameter');
    return;
  }

  const sncf = new SNCF(process.env.SNCF_API_URL as string, process.env.SNCF_API_KEY as string);
  const resTimes = await fetchDataFromLineDataPrim(sncf, lineData, dateFrom);

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(resTimes));
});

app.get('/departuresPrim/:id', async (req, res) => {
  const { id } = req.params;
  const primData = primsData.find((line) => line.id === Number(id));

  if (!primData) {
    res.status(404);
    res.send('Prim data not found');
    return;
  }

  const prim = new Prim(
    process.env.SNCF_API_PRIM_URL as string,
    process.env.SNCF_API_PRIM_KEY as string,
  );

  const departuresFrom = await prim.getDepartures(primData);

  if (departuresFrom.data.length === 0) {
    res.status(404);
    res.send();
    return;
  }
  const departuresRes = getDeparturesFromPrim(primData, departuresFrom.data);

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({
    title: primData.departureName,
    data: departuresRes,
  }));
});

app.get('/departuresCrawl/:id', async (req, res) => {
  const { id } = req.params;
  const lineData = linesData.filter((line) => line.id === Number(id))[0];

  if (!lineData) {
    res.status(404);
    res.send('Line not found');
    return;
  }

  const crawl = new Crawl(process.env.SNCF_CRAWL_URL as string);

  const crawlRes = await crawl.getDepartures(lineData);

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(crawlRes));
});

app.listen(port, () => {
  console.log(`Express is listening at http://localhost:${port}`);
});
