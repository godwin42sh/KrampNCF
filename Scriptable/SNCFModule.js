// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: magic;
const Conf = importModule("KrampNCF-Conf");
const SendNotification
 = importModule("SendNotification");

const fontText = "Avenir-Medium";
const fontTextLight = "Avenir-Light";
const fontTextBold = "Avenir-Heavy";

// const colorBGLight = new Color("f6f6f6");
// const colorBGDark = new Color("d3d3d3");
const colorBGLight = new Color("2B313A");// 
const colorBGDark = new Color("161B26");

// const colorBGTransparentDark = new Color("d3d3d3");

const setSNCFBackground = (stack, color, radius = false) => {
//   stack.backgroundColor = color === 'light' ? colorBGLight : colorBGDark;

  stack.borderWidth = 1;
  stack.borderColor = color === 'light' ? colorBGLight : colorBGDark;

  if (Number.isInteger(radius)) {
    stack.cornerRadius = radius;
  }
}

const filterOnlyDelays = (trains) => {
  return trains.filter(train => {
    train.data.find(schedule => schedule.delay && schedule.delay >= 5);
  });
}

const setTrainUrl = (trainStack, trainTitle) => {
  if (!Conf.correspUrlTrain[trainTitle]) {
    return;
  }
  
  trainStack.url = Conf.correspUrlTrain[trainTitle];
}

const makeTrainTitle = (trainStack, train) => {
  const titleStack = trainStack.addStack();
  titleStack.layoutHorizontally();
  titleStack.centerAlignContent();

  titleStack.setPadding(0, 5, 0, 5);

  const titleTrainExp = train.title.split(' - ');
  const title = titleStack.addText(titleTrainExp[0]);

  title.font = new Font(fontTextBold, 15,7);

  title.lineLimit = 1;

  titleStack.addSpacer();

  const dateTitle = titleStack.addText(titleTrainExp[1]);
  dateTitle.font = new Font(fontText, 12);

	dateTitle.rightAlignText();
  trainStack.addSpacer(3);
  
  setTrainUrl(trainStack, titleTrainExp[0]);
}

const getTimeTextAndColor = (data) => {
	let color = Color.white();

  const departureSanitized = {
    time: data.departureTime ? data.departureTime : data.departure.time,
    delay: data.delay ?? data.departure?.delay
};

	let timeText = departureSanitized.time;

  if (departureSanitized.delay) {
    timeText = `${departureSanitized.time}+${departureSanitized.delay}`;
    color = Color.red();
  }
  
  return [timeText, color];
}

const makeTrainDock = (scheduleStack, dock) => {
  scheduleStack.setPadding(1, 0, 1, 0)
  scheduleStack.addSpacer();
  const dockStack = scheduleStack.addStack();
  dockStack.borderColor = Color.white();
  dockStack.borderWidth = 1;
  dockStack.cornerRadius = 2;
  dockStack.setPadding(0,4,0,4);
  dockStack.centerAlignContent();
  
  const dockText = dockStack.addText(dock);
  dockText.font = new Font(fontTextLight, 14);
}

const sendNotifWhenDelay = (data, departure, trainTitle) => {
  const notifText = departure.time + ' +' + departure.delay;

  SendNotification.sendUniqNotif(data.title, notifText, Conf.correspUrlTrain[trainTitle]);
}

const makeTrainTime = (scheduleStack, data, trainTitle) => {
  const departureSanitized = {
    time: data.departureTime ? data.departureTime : data.departure.time,
//     delay: data.delay ?? data.departure?.delay
    delay: data.delay >= 5 ? data.delay : undefined
};

	let timeText = departureSanitized.time;
  
    const time = scheduleStack.addText(timeText);
  time.font = new Font(fontTextBold, 15);

//   time.minimumScaleFactor = 0.9;
  time.lineLimit = 1;

  if (departureSanitized.delay) {
    sendNotifWhenDelay(data, departureSanitized, trainTitle);
    const delayText = scheduleStack.addText(`+${departureSanitized.delay}`);
    color = Color.red();
    time.textColor = color;
    delayText.textColor = color;
    delayText.font = new Font(fontTextBold, 10);
  }
}

const makeTrainSchedule = (trainStack, data, delaysOnly, trainTitle) => {
  const containerStack = trainStack.addStack();
  containerStack.layoutHorizontally();
  containerStack.centerAlignContent();
  
  const scheduleStack = containerStack.addStack();
  scheduleStack.layoutHorizontally();
  scheduleStack.centerAlignContent();

  makeTrainTime(scheduleStack, data, trainTitle);

	if (!delaysOnly) {
    scheduleStack.addSpacer();
    const nameStack = scheduleStack.addStack();
		const nameStation = nameStack.addText(data.title);
//     nameStack.size = new Size(57, 0);
		nameStation.font = new Font(fontText, 13);
//     nameStation.minimumScaleFactor = 0.9;
    nameStation.lineLimit = 1;
  }
  
  if (data.dock) {
    makeTrainDock(scheduleStack, data.dock);
  }
  else {
    scheduleStack.addSpacer(28.5);
  }
}

const makeEmptySchedules = (schedulesStack) => {
  const emptyStack = schedulesStack.addStack();
  
  emptyStack.addSpacer();
  
  const noData = emptyStack.addText("Aucune circulation");
  noData.font = new Font(fontText, 14);
  
  emptyStack.addSpacer();
}

const makeTrain = (stack, train, isLast, delaysOnly = false, limit = 5) => {
  const trainStack = stack.addStack();
//   setSNCFBackground(trainStack, 'dark', 10);
  trainStack.layoutVertically();
	trainStack.centerAlignContent();
  trainStack.setPadding(5, 5, 5, 5);

	if (train.title === undefined) {
    trainStack.addText("No data");
    if (!isLast) {
      stack.addSpacer(75);
    }
    return;
  }
  
  makeTrainTitle(trainStack, train);

	const schedulesStack = trainStack.addStack();
  schedulesStack.layoutVertically();
  setSNCFBackground(schedulesStack, 'light', 5);
  schedulesStack.setPadding(5, 7, 5, 7);

  if (train.data.length === 0) {
    makeEmptySchedules(schedulesStack);
    if (!isLast) {
      stack.addSpacer(3);
    }
    return;
  }

  //we limit to only first 5 train to avoid breaking display
  train.data.slice(0, limit).forEach(data => {
    if (delaysOnly && data.departure && !data.departure.delay) {
      return;
    }
    makeTrainSchedule(schedulesStack, data, delaysOnly, train.title);
  });
  
  if (!isLast) {
    stack.addSpacer(3);
  }
}

module.exports = { makeTrain, setSNCFBackground, filterOnlyDelays };