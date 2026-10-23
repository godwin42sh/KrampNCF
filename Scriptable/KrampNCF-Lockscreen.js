// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: magic;
// Lockscreen (accessoryRectangular, the 1x2 slot) widget: next train only,
// with its delay, on a transparent background.
// Widget parameter: board id (1 = Étampes→Austerlitz, 2 = Austerlitz→Étampes);
// defaults to 1 before noon, 2 after.
const Conf = importModule("KrampNCF-Conf");
const SNCFModule = importModule("SNCFModule");

const dateNow = new Date();
const hours = dateNow.getHours();
const idDeparture = args.widgetParameter || (hours < 12 ? 1 : 2);

const widget = new ListWidget();
widget.addAccessoryWidgetBackground = false;
widget.backgroundColor = Color.clear();
widget.refreshAfterDate = new Date(
  dateNow.getTime() + 1000 * 60 * ((hours >= 7 && hours <= 8) || (hours >= 16 && hours <= 18) ? 3 : 15)
);

const req = new Request(Conf.getUrlDeparturesSiriById(idDeparture));
const board = await req.loadJSON();

// ponytail: "HH:mm" compared within the current day; a train just after
// midnight looks past — fine for a commute widget, revisit if that matters.
const minutesOfDay = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const nowMinutes = dateNow.getHours() * 60 + dateNow.getMinutes();

const nextTrain = (board.data || []).find(
  (t) => !t.deleted && minutesOfDay(t.departureTime) + (t.delay || 0) >= nowMinutes
);

const station = (board.title || "").split(" - ")[0];

const titleText = widget.addText(station);
titleText.font = Font.mediumSystemFont(12);
titleText.lineLimit = 1;

if (!nextTrain) {
  const noData = widget.addText("Aucune circulation");
  noData.font = Font.mediumSystemFont(14);
} else {
  const timeStack = widget.addStack();
  timeStack.centerAlignContent();

  const time = timeStack.addText(nextTrain.departureTime);
  time.font = Font.heavySystemFont(20);

  if (nextTrain.delay) {
    const delayText = timeStack.addText(` +${nextTrain.delay}`);
    delayText.font = Font.heavySystemFont(14);
    delayText.textColor = Color.red();
    time.textColor = Color.red();
  }

  if (nextTrain.dock) {
    timeStack.addSpacer(6);
    const dock = timeStack.addText(`Voie ${nextTrain.dock}`);
    dock.font = Font.lightSystemFont(12);
  }

  const dest = widget.addText(nextTrain.title);
  dest.font = Font.systemFont(12);
  dest.lineLimit = 1;

  await SNCFModule.notifyDelayOnce(nextTrain, station);
}

if (!config.runsInWidget) {
  widget.presentAccessoryRectangular();
}

Script.setWidget(widget);
Script.complete();
