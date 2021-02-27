import {
  State,
  init_Params_Measures,
  start_sim,
} from './simulation-control';
import {
  initLegend,
} from './map-plot';
import "./sass/default.scss";



var gState = new State();

//---- Controls ---------------------------------------------------------------------------------------------------------------

// const MAX_DAYS = 200;
var runner = document.getElementById("run");
const RunButtonContents = {
  PAUSED: "<i class='icon ic-run'></i> Run the simulation",
  RUNNING: "<i class='icon ic-pause'></i> Pause the simulation",
}
function updateRunButton() {
  runner.innerHTML = gState.running ? RunButtonContents.RUNNING : RunButtonContents.PAUSED;
}
function toggleRunButton() {
  gState.running = !gState.running;
  updateRunButton();
}

var runButton = document.getElementById("run");
runButton.addEventListener('click', toggleRunButton);
updateRunButton();



//---- Initialization --------------------------------------------------------------------------------------------------------- 
init_Params_Measures(gState);


//---- Map Rendering ----------------------------------------------------------------------------------------------------------
initLegend();

//---- Load & Preprocess Data -------------------------------------------------------------------------------------------------

d3.queue()
  .defer(d3.json, "data/landkreise_simplify200.geojson")
  .defer(d3.csv, "data/7T_Inzidenz_LK_22_1.csv", function (d) {
    gState.incidence.push({ name: d.Landkreis, tag: d.LKNR, active: d.Anzahl, inc: d.Inzidenz })
  })
  .await((e,t) => start_sim(e,t,gState));
