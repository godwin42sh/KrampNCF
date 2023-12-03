import dotenv from 'dotenv';
import express from 'express';

import linesData from './conf/lines-data';
import {
  fetchDataFromLineData,
  fetchDataFromLinesData,
  getDateFromQuery,
} from './utils';
import {
  getDeparturesFromToRealtime,
  getDeparturesFromLineDataRealtime,
} from './utilsRT';
import { SNCF } from './sncf-api';
import { readGtfsRT } from './gtfs-api';

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
  const resTimes = await fetchDataFromLinesData(sncf, linesData, dateFrom);

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
  const resTimes = await fetchDataFromLineData(sncf, lineData, dateFrom);

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(resTimes));
});

app.listen(port, () => {
  console.log(`Express is listening at http://localhost:${port}`);
});
