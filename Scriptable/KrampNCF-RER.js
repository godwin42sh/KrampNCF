// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: magic;
const widget = new ListWidget();

const SNCFModule = importModule("SNCFModule");
const BGTransparent = importModule("BG-Transparent");
const Conf = importModule("KrampNCF-Conf");

const dateNow = new Date();
const hours = dateNow.getHours();
const widgetParam = args.widgetParameter;
const delaysOnly = widgetParam === 'delays';
const idDeparture = !delaysOnly ? args.widgetParameter : false;

if ((hours >= 7 && hours <= 8) || (hours >= 16 && hours <= 18)) {
    widget.refreshAfterDate = new Date(dateNow.getTime() + 1000 * 60 * 3);
}
else {
    widget.refreshAfterDate = new Date(dateNow.getTime() + 1000 * 60 * 15);
}

widget.setPadding(5,5,5,5);

const stack = widget.addStack();
stack.layoutHorizontally();
stack.topAlignContent();
stack.setPadding(10, 0, 5, 0);

// SIRI ET realtime for both directions, filtered to RER C only, with "RER"
// injected into the board title ("Étampes - 24/07" -> "Étampes RER - 24/07").
const url = Conf.getUrlDeparturesSiriByType('train');
const req = new Request(url);
const reqData = await req.loadJSON();

const rerBoards = Array.isArray(reqData)
  ? reqData.map((board) => ({
      ...board,
      title: board.title.replace(' - ', ' RER - '),
      data: board.data.filter((train) => train.trainType === 'RER'),
    }))
  : reqData;

if (Array.isArray(rerBoards)) {
  if (hours >= 12) {
    rerBoards.reverse();
  }

  rerBoards.forEach((train, index) => {
    const isLast = index === rerBoards.length - 1;
    SNCFModule.makeTrain(stack, train, isLast, delaysOnly);
  });
}
else {
  SNCFModule.makeTrain(stack, rerBoards, true, delaysOnly);
}

// BGTransparent.setTransparentBackground(widget, config.widgetFamily, "top");
// SNCFModule.setSNCFBackground(widget, 'light');

widget.addSpacer();

if (!config.runsInWidget) {
  widget.presentMedium();
}

Script.setWidget(widget);
Script.complete();