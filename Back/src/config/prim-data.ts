import { PrimData } from "../types/PrimData";

// StopArea (ZdL) references come from IDFM's "zones-d-arrets" dataset,
// railStation rows: Étampes = 43080, Gare d'Austerlitz = 43072.
// Both directions carry RER C (C01727) and TER (C01857); no line filter so
// every Paris–Étampes train shows up.
const primsData: PrimData[] = [
  {
    id: 1,
    departureName: "Étampes",
    destinationName: "Austerlitz",
    primDepartureRef: "STIF:StopArea:SP:43080:",
    destinationMatch: ["Paris Austerlitz"],
    type: "train",
  },
  {
    id: 2,
    departureName: "Austerlitz",
    destinationName: "Étampes",
    primDepartureRef: "STIF:StopArea:SP:43072:",
    // Trains toward Étampes terminate at Saint-Martin d'Étampes (the stop
    // right after Étampes); "Étampes" covers any that short-turn there.
    destinationMatch: ["Saint-Martin d'Étampes", "Étampes"],
    type: "train",
  },
];

export default primsData;
