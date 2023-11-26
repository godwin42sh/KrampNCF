import dotenv from 'dotenv';
import express from 'express';

import linesData from './conf/lines-data';
import { SNCF } from './sncf-api';
import { fetchDataFromLineData, fetchDataFromLinesData, getDateFromQuery } from './utils';

dotenv.config();

const app = express();
const port = process.env.PORT || 80;

app.get('/', async (req, res) => {
  const sncf = new SNCF(process.env.SNCF_API_URL as string, process.env.SNCF_API_KEY as string);
  const stations = await sncf.getStations();

  res.send(`Hello World! ${JSON.stringify(stations)}`);
});

app.get('/departures/', async (req, res) => {
  const dateFrom = await getDateFromQuery(req.query.dateFrom as string | undefined);

  if (!dateFrom) {
    res.status(400);
    res.send('Invalid dateFrom parameter');
    return;
  }

  const resTimes = await fetchDataFromLinesData(linesData, dateFrom);

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

  const resTimes = await fetchDataFromLineData(lineData, dateFrom);

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(resTimes));
});

app.listen(port, () => {
  console.log(`Express is listening at http://localhost:${port}`);
});
