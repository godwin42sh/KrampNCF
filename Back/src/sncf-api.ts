import axios, { AxiosInstance } from "axios";
import { format } from "date-fns";
import Redis from "ioredis";

import type { Departure } from "./types/Departure";
import type { IsCached } from "./types/IsCached";
import type { LineDataFilters } from "./types/LineData";

export class SNCF {

  private api: AxiosInstance;

  constructor(apiUrl: string, apiKey: string) {
    this.api = axios.create({
      baseURL: `${apiUrl}/coverage/fr-idf/`,
      headers: {
        Authorization: `Basic ${apiKey}`,
      },
    });
  }

  async getStations() {
    try {
      const { data } = await this.api.get('stop_areas');
      return data.stop_areas;
    }
    catch (e) {
      console.log(e);
      return [];
    }
  }

  async getDepartures(stationId: string, dateFrom: Date, filters?: LineDataFilters): Promise<IsCached<Departure[]>> {

    const redis = new Redis((process.env.REDIS_URL as string));

    let additionalParams = '';

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        additionalParams += `/${key}/${value}`;
      });
    }

    const url = `stop_areas/${stationId}${additionalParams}/departures?from_datetime=${dateFrom.toISOString()}`;
    const redisKey = `${stationId}${additionalParams}/departures/${format(dateFrom, 'yyyyMMdd.HH.mm')}`;

    const cached = await redis.get(redisKey);

    if (cached) {
      console.log('using cached result');
      return {
        isCached: true,
        data: JSON.parse(cached),
      };
    }
    else {
      let resData: Departure[] = [];
      console.log('fething from SNCF API');

      try {
        const { data } = await this.api.get(url);
        resData = data.departures;
      }
      catch (e) {
        console.log(e);
      }
      redis.set(redisKey, JSON.stringify(resData), 'EX', 120);
      return {
        isCached: false,
        data: resData,
      };
    }
  }
}