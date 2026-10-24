// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: magic;
const widget = new ListWidget();

const SNCFModule = importModule("SNCFModule");
const BGTransparent = importModule("BG-Transparent");
const Conf = importModule("KrampNCF-Conf");

const dateNow = new Date();
const hours = dateNow.getHours();
// Widget parameter "table" switches to the full-width table layout
// (one section per direction, rows: time | line | destination | voie).
const useTable = args.widgetParameter === 'table';

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

const fontText = "Avenir-Medium";
const fontTextBold = "Avenir-Heavy";
const colorMuted = new Color("B8B8B8");
const colorRER = new Color("F0C929");
const colorRemi = new Color("E07A74");

const makeTableRow = (train, station, alt) => {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.setPadding(2, 6, 2, 6);
  if (alt) {
    row.backgroundColor = new Color("FFFFFF", 0.06);
    row.cornerRadius = 6;
  }

  const timeStack = row.addStack();
  timeStack.size = new Size(66, 0);
  timeStack.centerAlignContent();
  const time = timeStack.addText(train.departureTime);
  time.font = new Font(fontTextBold, 14);
  time.lineLimit = 1;
  if (train.deleted) {
    time.textColor = colorMuted;
  } else if (train.delay) {
    // Red is stripped in iOS tinted home-screen mode, so the +N size/weight
    // must carry the information on its own.
    time.textColor = Color.red();
    const delayText = timeStack.addText(` +${train.delay}`);
    delayText.font = new Font(fontTextBold, 11);
    delayText.textColor = Color.red();
  }
  timeStack.addSpacer();
  SNCFModule.notifyTrainOnce(train, station);

  const lineStack = row.addStack();
  lineStack.size = new Size(44, 0);
  lineStack.centerAlignContent();
  const isRER = train.trainType === 'RER';
  const line = lineStack.addText(isRER ? 'RER C' : 'Rémi');
  line.font = new Font(fontText, 10);
  line.textColor = isRER ? colorRER : colorRemi;
  lineStack.addSpacer();

  const dest = row.addText(train.deleted ? 'Supprimé' : train.title);
  dest.font = new Font(fontText, 12);
  dest.lineLimit = 1;
  if (train.deleted) {
    dest.textColor = Color.red();
  }
  row.addSpacer();

  const voie = row.addText(train.deleted ? '–' : (train.dock || '–'));
  voie.font = new Font(fontText, 12);
};

const makeTableSection = (board, isLast) => {
  const station = board.title.split(' - ')[0];
  const header = widget.addText(`${station} →`);
  header.font = new Font(fontText, 11);
  header.textColor = colorMuted;
  widget.addSpacer(3);

  const trains = board.data.slice(0, 5);
  if (trains.length === 0) {
    const noData = widget.addText("Aucune circulation");
    noData.font = new Font(fontText, 12);
  }
  trains.forEach((train, i) => makeTableRow(train, station, i % 2 === 0));

  if (!isLast) {
    widget.addSpacer(8);
  }
};

// Auto realtime source for both directions (Étampes and Austerlitz boards),
// each mixing RER C and mainline Rémi (TER).
const reqData = await SNCFModule.fetchBoards(Conf.getUrlDeparturesAuto());

// Split into a Rémi (TER) table and a RER table, keeping both directions.
// The type shows in each table header (small, non-bold) via typeLabel.
const boardsByType = (boards, trainType, label) =>
  boards.map((board) => ({
    ...board,
    typeLabel: label,
    data: board.data.filter((train) => train.trainType === trainType),
  }));

if (Array.isArray(reqData)) {
  if (useTable) {
    const boards = hours >= 12 ? [...reqData].reverse() : reqData;
    boards.forEach((board, i) => makeTableSection(board, i === boards.length - 1));
  } else {
    addStackFromReqData(boardsByType(reqData, 'TER', 'Rémi'), hours);
    addStackFromReqData(boardsByType(reqData, 'RER', 'RER'), hours);
  }
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