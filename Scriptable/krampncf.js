const widget = new ListWidget();

const token = "";
const req = new Request("https://"+token+"@sncf.krampflix.ovh/departures");
const reqData = await req.loadJSON();
const now = Date.now();
widget.refreshAfterDate = new Date(now + 1000 * 60 * 2); // we refresh every 2 minutes

const stack = widget.addStack();
stack.layoutHorizontally();

function makeTrain(train) {
  const trainStack = stack.addStack();
  trainStack.layoutVertically();
  const title = trainStack.addText(train.title);
  title.font = Font.boldSystemFont(16);

  if (train.data.length === 0) {
    trainStack.addText("Pas de train");
    return;
  }

  train.data.forEach(data => {
    trainStack.addText(data.title);
    trainStack.addText(data.departureTime);
    trainStack.addText(data.arrivaleTime);
  });
}

reqData.forEach(train => {
  makeTrain(train);
});

Script.setWidget(widget);
Script.complete();