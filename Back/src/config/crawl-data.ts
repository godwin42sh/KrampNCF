import { CrawlData } from "../types/CrawlData";
import { TrainType } from "../types/CrawlFlareDeparture";

const crawlsData: CrawlData[] = [
  {
    id: 1,
    title: "Étampes",
    flareId: "0087545137",
    destinationName: "Austerlitz",
    stopToMatch: ["Paris Austerlitz", "Paris Austerlitz RER C", "Musée d'Orsay"],
  },
  {
    id: 2,
    title: "Austerlitz",
    flareId: "0087547000",
    destinationName: "Étampes",
    stopToMatch: ["Étampes", "St-Martin d'Étampes", "Orléans"],
    // "Rémi Exp" runs Paris → Les Aubrais → Orléans without calling at
    // Étampes; plain "Rémi" is the omnibus that does stop there.
    excludeTrainTypes: [TrainType.RémiExp],
  },
];

export default crawlsData;
