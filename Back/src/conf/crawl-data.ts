import { CrawlData } from '../types/CrawlData';

const crawlsData: CrawlData[] = [
  {
    id: 1,
    title: 'Étampes',
    flareId: '0087545137',
    destinationName: 'Austerlitz',
    stopToMatch: ['Paris Austerlitz', 'Paris Austerlitz RER C'],
  },
  {
    id: 2,
    title: 'Austerlitz',
    flareId: '0087547000',
    destinationName: 'Étampes',
    stopToMatch: ['Étampes'],
  },
];

export default crawlsData;
