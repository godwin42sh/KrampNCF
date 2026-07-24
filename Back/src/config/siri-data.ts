import { SiriBoard } from "../types/SiriEt";

// UIC stop codes as they appear in the SIRI ET feed (StopPointRef suffix).
// Paris-Austerlitz is two stops there: the mainline station and the RER C one.
const AUSTERLITZ_UICS = ["87547000", "87547026"];
const ETAMPES_UICS = ["87545137"];

const siriBoards: SiriBoard[] = [
  {
    id: 1,
    departureName: "Étampes",
    destinationName: "Austerlitz",
    fromUics: ETAMPES_UICS,
    toUics: AUSTERLITZ_UICS,
    type: "train",
  },
  {
    id: 2,
    departureName: "Austerlitz",
    destinationName: "Étampes",
    fromUics: AUSTERLITZ_UICS,
    toUics: ETAMPES_UICS,
    type: "train",
  },
];

export default siriBoards;
