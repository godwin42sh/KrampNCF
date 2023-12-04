// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: magic;
const widget = new ListWidget();
const token = "6s8Xd8ybPfue65nMLHs:6s8Xd8ybPfue65nMLHs";

const dateNow = new Date();
const hours = dateNow.getHours();
const onlyDelays = args.widgetParameter === "delays";
const idDeparture = args.widgetParameter !== "delays" ? args.widgetParameter : false;

if ((hours >= 7 && hours <= 8) || (hours >= 16 && hours <= 18)) {
	widget.refreshAfterDate = new Date(dateNow.getTime() + 1000 * 60 * 3);
}
else {
	widget.refreshAfterDate = new Date(dateNow.getTime() + 1000 * 60 * 30);
}

const stack = widget.addStack();
stack.layoutHorizontally();
stack.topAlignContent();

function makeTrain(train) {
  const trainStack = stack.addStack();
  trainStack.layoutVertically();

  const title = trainStack.addText(train.title);
  
  title.font = Font.boldSystemFont(16);
  trainStack.addSpacer(5);
  
  if (train.data.length === 0) {
    trainStack.addText("Pas de train");
    return;
  }
  train.data.forEach(data => {
    const dataStack = trainStack.addStack();
    dataStack.layoutHorizontally();

    if (!onlyDelays) {
      const nameStation = dataStack.addText(data.title);
      nameStation.font = Font.systemFont(14);
      dataStack.addSpacer(5);
    }

    let timeText = data.departureTime;
    let color = Color.white();

    if (data.delay) {
      timeText = `${data.departureTime} +${data.delay}m`;
      color = Color.red();
    }

    const time = dataStack.addText(timeText);
    time.font = Font.boldSystemFont(16);
    time.textColor = color;
  });
  
	trainStack.setPadding(0, 10, 0, 10);
}

function setTransparentBackground(widget) {
  const fileName = "Transparent-m-m.jpg"
  const files = FileManager.local()
  const filePath = files.joinPath(files.documentsDirectory(), fileName)

  if (files.fileExists(filePath)) {
    widget.backgroundImage = files.readImage(filePath)
  }
}

const url = "https://"+token+"@sncf.krampflix.ovh/departures/" + (idDeparture ? idDeparture : "");
const req = new Request(url);
const reqData = await req.loadJSON();

if (Array.isArray(reqData)) {
  reqData.forEach(train => {
    if (onlyDelays && train.data.every(data => !data.delay)) {
      return;
    }
    makeTrain(train);
  });
}
else {
  makeTrain(reqData);
}

widget.addSpacer()
setTransparentBackground(widget)

Script.setWidget(widget);
Script.complete();