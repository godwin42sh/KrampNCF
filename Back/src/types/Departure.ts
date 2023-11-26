export interface Departure {
  display_informations: {
    code: string,
    color: string,
    commercial_mode: string,
    description: string,
    direction: string,
    equipments: [],
    headsign: string,
    label: string,
    links: [],
    name: string,
    network: string,
    physical_mode: string,
    text_color: string,
    trip_short_name: string
  },
  links: [{
    id: string,
    type: string
  }],
  route: {
    direction: {
      embedded_type: string,
      id: string,
      quality: string,
      type: string
    },
  },
  stop_date_time: {
    departure_date_time: string,
    base_departure_date_time: string,
    arrival_date_time: string,
    base_arrival_date_time: string,
    additional_informations: [],
    links: [],
    data_freshness: string
  },
}
