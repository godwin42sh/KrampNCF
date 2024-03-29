// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: brown; icon-glyph: magic;
const token = "";

const correspUrlTrain = {
  "Étampes": "https://www.sncf.com/fr/gares/etampes/OCE87545137/departs-arrivees/gl/departs",
  "Austerlitz": "https://www.sncf.com/fr/gares/paris-austerlitz/OCE87547000/departs-arrivees/gl/departs"
};

const getUrlDepartures = (isRT, idDeparture) => {
  const departuresType = isRT ? 'departuresRT' : 'departures';
  return `https://${token}@sncf.krampflix.ovh/${departuresType}/${(idDeparture ? idDeparture : "")}`;
}
module.exports = { getUrlDepartures, correspUrlTrain };