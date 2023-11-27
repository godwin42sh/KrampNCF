const widget = new ListWidget();
const token = "6s8Xd8ybPfue65nMLHs:6s8Xd8ybPfue65nMLHs";
const req = new Request("https://sncf.krampflix.ovh/departures");
const reqData = await req.loadJSON();

const dateNow = new Date();
const hours = dateNow.getHours();

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

    const nameStation = dataStack.addText(data.title);
    nameStation.font = Font.systemFont(14);
    dataStack.addSpacer(5);

    const time = dataStack.addText(data.departureTime);
    time.font = Font.boldSystemFont(16);
  });

    trainStack.setPadding(0, 10, 0, 10);
}

reqData.forEach(train => {
  makeTrain(train);
});

Script.setWidget(widget);
Script.complete();
