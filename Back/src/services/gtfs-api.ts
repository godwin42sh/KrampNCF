import axios from 'axios';
import Redis from 'ioredis';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { ca } from 'date-fns/locale';

export async function readGtfsRT(): Promise<[GtfsRealtimeBindings.transit_realtime.FeedMessage, boolean] | false> {
  const redis = new Redis((process.env.REDIS_URL as string));

  const cached = await redis.get('gtfsRT');

  if (cached) {
    return [
      JSON.parse(cached) as GtfsRealtimeBindings.transit_realtime.FeedMessage,
      true,
    ];
  }

  const requestSettings = {
    method: 'GET',
    url: process.env.SNCF_GTFSRT_URL as string,
    encoding: null,
  };

  try {
    const req = await axios.get(requestSettings.url, { responseType: 'arraybuffer' });

    const feed = await GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(req.data);

    redis.set('gtfsRT', JSON.stringify(feed), 'EX', 60);

    return [
      feed,
      false,
    ];
  }
  catch (e) {
    console.error(e);
    return false;
  }
}

export default readGtfsRT;
