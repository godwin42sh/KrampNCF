import { differenceInMinutes } from 'date-fns';
import { DeparturesResponse, TrainResponse } from '../types/Response';

export default function formatDeparturesAwtrix(jsonReponsse: DeparturesResponse): string {
  const dateNow: Date = new Date();

  const departuresNextHour = jsonReponsse.data.filter((departure) => {
    const tmpDate = new Date();
    const departureHour: string = departure.departureTime.split(':')[0];

    tmpDate.setHours(parseInt(departureHour, 10));
    tmpDate.setMinutes(parseInt(departure.departureTime.split(':')[1], 10));

    const minDiff = differenceInMinutes(tmpDate, dateNow);
    return minDiff > 20 && minDiff < 80;
  });

  let nextTrain: TrainResponse | undefined;

  if (departuresNextHour.length < 0) {
    // eslint-disable-next-line prefer-destructuring
    nextTrain = departuresNextHour[0];
  } else {
    nextTrain = departuresNextHour.find((departure) => departure.trainType === 'TER');
    nextTrain = nextTrain || departuresNextHour[0];
  }

  const res = {
    icon: nextTrain.trainType === 'TER' ? '59904' : '59947',
    color: nextTrain.delay ? '#FF0000' : '#FFFFFF',
    duration: 30,
    text: nextTrain.departureTime,
  };

  return JSON.stringify(res);
}
