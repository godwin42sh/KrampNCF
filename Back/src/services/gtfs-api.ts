import Redis from "ioredis";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

export async function readGtfsRT(): Promise<
  [GtfsRealtimeBindings.transit_realtime.FeedMessage, boolean] | false
> {
  const redis = new Redis(process.env.REDIS_URL as string);

  const cached = await redis.get("gtfsRT");

  if (cached) {
    return [
      JSON.parse(cached) as GtfsRealtimeBindings.transit_realtime.FeedMessage,
      true,
    ];
  }

  const url = process.env.SNCF_GTFSRT_URL as string;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();

    const feed = await GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(arrayBuffer),
    );

    redis.set("gtfsRT", JSON.stringify(feed), "EX", 60);

    return [feed, false];
  } catch (e) {
    console.error(e);
    return false;
  }
}

export default readGtfsRT;
