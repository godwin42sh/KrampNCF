import { differenceInMinutes } from 'date-fns';
import { DeparturesResponse, TrainResponse } from '../types/Response';

export type AwtrixResponse = {
  icon: string;
  color: string;
  pos: number;
  text: string;
};

export default function formatDeparturesAwtrix(jsonReponsse: DeparturesResponse): AwtrixResponse {
  const dateNow: Date = new Date();

  const iconTer = process.env.AWTRIX_ICON_TER as string || '59998';
  const iconRer = process.env.AWTRIX_ICON_RER as string || '59997';

  if (!jsonReponsse.data) {
    return {
      icon: iconTer,
      color: '#FF0000',
      pos: 1,
      text: 'No trains',
    };
  }

  const departuresNextHour = jsonReponsse.data.filter((departure) => {
    if (departure.deleted === true) {
      return false;
    }
    const tmpDate = new Date();
    const departureHour: string = departure.departureTime.split(':')[0];

    tmpDate.setHours(parseInt(departureHour, 10));
    tmpDate.setMinutes(parseInt(departure.departureTime.split(':')[1], 10));

    const minDiff = differenceInMinutes(tmpDate, dateNow);
    return minDiff > 20 && minDiff < 80;
  });

  let nextTrain: TrainResponse | undefined;

  if (departuresNextHour.length === 0) {
    // eslint-disable-next-line prefer-destructuring
    nextTrain = jsonReponsse.data[0];
  } else {
    nextTrain = departuresNextHour.find((departure) => departure.trainType === 'TER');
    nextTrain = nextTrain || departuresNextHour[0];
  }

  const res = {
    icon: nextTrain.trainType === 'TER' ? iconTer : iconRer,
    color: nextTrain.delay ? '#FF0000' : '#FFFFFF',
    pos: 1,
    text: nextTrain.departureTime,
  };

  return res;
}
