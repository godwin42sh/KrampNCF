import { stringifyUrl } from "query-string";
import axios, { AxiosInstance } from "axios";
import { parse, HTMLElement } from 'node-html-parser';
import Redis from "ioredis";

import type { IsCached } from "../types/IsCached";
import { LineData } from "src/types/LineData";
import { CrawlRes } from "src/types/CrawlRes";

export class Crawl {

  private api: AxiosInstance;

  private titleDepartureCorresp = new Map<string, keyof CrawlRes>([
    ['Voie', 'dock'],
    ['Mode', 'trainNumber'],
    ['Départ', 'departureTime'],
  ]);

  constructor(apiUrl: string) {
    this.api = axios.create({
      baseURL: apiUrl,
      headers: {
        "Host": "www.ter.sncf.com",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Alt-Used": "www.ter.sncf.com",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      }
    });
  }

  parseParaGraphsFromHtml(paragraphs: HTMLElement[]): CrawlRes {
    const tmp: CrawlRes = {
      dock: "",
      trainNumber: "",
      departureTime: "",
    };

    paragraphs.forEach((paragraph) => {
      const title = paragraph.querySelector('.sr-only');

      if (!title) return;

      const titleKey = this.titleDepartureCorresp.get(title.text);

      if (!titleKey) return;

      title.remove();

      if (titleKey === 'trainNumber') {
        const trainNumber = paragraph.text.split(' ').at(-1);
        tmp[titleKey] = trainNumber ?? paragraph.text;
      }
      else {
        tmp[titleKey] = paragraph.text;
      }
    });
    return tmp;

  }

  parseDeparturesFromHtml(html: string): CrawlRes[] {
    const res: CrawlRes[] = [];
    const root = parse(html);

    const accordionElements = root.querySelectorAll('.MuiAccordion-root');

    accordionElements.forEach((accordionElement) => {
      const paragraphs = accordionElement.querySelectorAll('p');
      res.push(this.parseParaGraphsFromHtml(paragraphs));
    });

    return res;
  }

  async getDepartures(lineData: LineData): Promise<IsCached<CrawlRes[]>> {

    const redis = new Redis((process.env.REDIS_URL as string));
    const cacheTime = process.env.REDIS_CRAWL_EXPIRE ? parseInt(process.env.REDIS_CRAWL_EXPIRE) : 300;

    const url = '/' + lineData.crawlUrlParam;
    const redisKey = url;

    const cached = await redis.get(redisKey);

    if (cached) {
      console.log('using cached result');
      return {
        isCached: true,
        data: JSON.parse(cached),
      };
    }
    else {
      let resData: CrawlRes[] = [];
      console.log('crawling from SNCF schedule', url);

      try {
        const { data } = await this.api.get(url);

        resData = this.parseDeparturesFromHtml(data);
        redis.set(redisKey, JSON.stringify(resData), 'EX', cacheTime);
      }
      catch (e) {
        // console.log(e);
        if (axios.isAxiosError(e)) {
          console.log('error while crawling', e.message);
        }
      }
      return {
        isCached: false,
        data: resData,
      };
    }
  }
}