import {
  State,
  init_Params_Measures,
  simulate_step,
  findIncidence,
} from './simulation-control';
import {
  region_with_incidence,
} from './game-engine';
import {
  initLegend,
  draw_map,
} from './map-plot';
import "./sass/default.scss";
import TimelineChart from './timeline-chart';



var gState = new State();

//---- Controls ---------------------------------------------------------------------------------------------------------------

const MAX_DAYS = 200;
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

function updateProgressBar(day) {
  $('#gameProgressDay').html(`${day} ${day === 1 ? 'day' : 'days'}`);
  $('#gameProgress .progress-bar').css('width', `${(day / MAX_DAYS) * 100}%`);
}

//---- Initialization --------------------------------------------------------------------------------------------------------- 
init_Params_Measures(gState);


//---- Map Rendering ----------------------------------------------------------------------------------------------------------
initLegend();

//---- Load & Preprocess Data -------------------------------------------------------------------------------------------------

// var incidence = [];

d3.queue()
  .defer(d3.json, "data/landkreise_simplify200.geojson")
  .defer(d3.csv, "data/7T_Inzidenz_LK_22_1.csv", function (d) {
    gState.incidence.push({ name: d.Landkreis, tag: d.LKNR, active: d.Anzahl, inc: d.Inzidenz })
  })
  .await(start_sim);

let timelineChart = null;

function start_sim(error, topo) {
  var regions = []
  topo.features.forEach(e => {
    let inc = findIncidence(gState, e.properties.AGS, 115); // TODO: default incidence hardcoded to 115, should be average from CSV dataset
    let r = region_with_incidence(e.properties.destatis.population, inc, e.properties.AGS, e.properties.GEN)
    // for distance between regions
    // two passes to prevent expensive recalculation
    r.centerOfMass = turf.centerOfMass(e.geometry).geometry.coordinates;
    regions.push(r);
  });

  // second pass ... finish up distance calculations
  regions.forEach((src_r) => {
    regions.forEach((dst_r, i) => {
      src_r.neighbours.push({ index: i, dist: turf.distance(src_r.centerOfMass, dst_r.centerOfMass) });
    });
  });

  gState.regions = regions;
  console.log("Initial State = ", gState);
  draw_map(topo, gState);

  console.log("done");

  const updateLoop = (topo, state) => {
    if (state.step_no > MAX_DAYS) { gState.running = false; }
    if (gState.running) {
      simulate_step(state);
      draw_map(topo, state);
      timelineChart.update();
      updateProgressBar(state.step_no);
      console.log("Rendered state", state);
    }

    setTimeout(updateLoop, 1000, topo, gState);
  };
  setTimeout(updateLoop, 1000, topo, gState);
  timelineChart = new TimelineChart($('#charts')[0], gState.country.I);
}
