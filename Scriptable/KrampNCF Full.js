// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: magic;
const widget = new ListWidget();

const SNCFModule = importModule("SNCFModule");
const BGTransparent = importModule("BG-Transparent");
const Conf = importModule("KrampNCF-Conf");

const dateNow = new Date();
const hours = dateNow.getHours();

if ((hours >= 7 && hours <= 8) || (hours >= 16 && hours <= 18)) {
    widget.refreshAfterDate = new Date(dateNow.getTime() + 1000 * 60 * 3);
}
else {
    widget.refreshAfterDate = new Date(dateNow.getTime() + 1000 * 60 * 15);
}

widget.setPadding(5,5,5,5);

const addStackFromReqData = (reqData, hours) => {
    const stack = widget.addStack();
	stack.layoutHorizontally();
	stack.topAlignContent();
	stack.setPadding(10, 0, 5, 0);

	if (hours >= 12) {
		reqData.reverse();
	}

	reqData.forEach((train, index) => {
		const isLast = index === reqData.length - 1;
		SNCFModule.makeTrain(stack, train, isLast, false);
	});
}

// SIRI ET realtime for every board (both directions: Étampes→Austerlitz and
// Austerlitz→Étampes, each mixing RER C and mainline Rémi).
const url = Conf.getUrlDeparturesSiriByType('train');
const req = new Request(url);
const reqData = await req.loadJSON();

if (Array.isArray(reqData)) {
  addStackFromReqData(reqData, hours);
}

// BGTransparent.setTransparentBackground(widget, "large", "bottom");// 
// SNCFModule.setSNCFBackground(widget, 'light');

widget.addSpacer();

if (!config.runsInWidget) {
  widget.presentLarge();
// console.log(config.widgetFamily)
}

Script.setWidget(widget);
Script.complete();