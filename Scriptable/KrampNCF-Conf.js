// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: brown; icon-glyph: magic;
const token = "";

const correspUrlTrain = {
//   "Étampes": "https://www.sncf.com/fr/gares/etampes/OCE87545137/departs-arrivees/gl/departs",
//   "Austerlitz": "https://www.sncf.com/fr/gares/paris-austerlitz/OCE87547000/departs-arrivees/gl/departs"
  "Austerlitz": "https://www.ter.sncf.com/grand-est/se-deplacer/prochains-departs/paris-austerlitz-87547000",
  "Étampes": "https://www.ter.sncf.com/grand-est/se-deplacer/prochains-departs/etampes-87545137"
};

const getUrlDepartures = (isRT, idDeparture) => {
  const departuresType = isRT ? 'departuresRT' : 'departures';
  return `https://${token}@sncf.krampflix.ovh/${departuresType}/${(idDeparture ? idDeparture : "")}`;
}

const getUrlDeparturesPrimByType = (type) => {
  return `https://${token}@sncf.krampflix.ovh/departuresPrimByType/${type}`;
}

const getUrlDeparturesPrimById = (idDeparture) => {
  return `https://${token}@sncf.krampflix.ovh/departuresPrim/${idDeparture}`;
}

const getUrlDeparturesSiriById = (idDeparture) => {
  return `https://${token}@sncf.krampflix.ovh/departuresSiri/${idDeparture}`;
}

const getUrlDeparturesSiriByType = (type) => {
  return `https://${token}@sncf.krampflix.ovh/departuresSiriByType/${type}`;
}

const getUrlDeparturesCrawlById = (id, type) => {
  const typeParam = type ? `?type=${type}` : '';
  return `https://${token}@sncf.krampflix.ovh/departuresCrawlFlare/${id}/${typeParam}`;
}

const getUrlDeparturesCrawl = (type) => {
  const typeParam = type ? `?type=${type}` : '';
  return `https://${token}@sncf.krampflix.ovh/departuresCrawlFlare${typeParam}`;
}

module.exports = { getUrlDepartures,  getUrlDeparturesCrawlById, getUrlDeparturesCrawl,
getUrlDeparturesPrimById,
getUrlDeparturesPrimByType,
getUrlDeparturesSiriById,
getUrlDeparturesSiriByType, correspUrlTrain };