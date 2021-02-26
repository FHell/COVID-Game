import {
  Measures,
  DynParameters,
  region_with_incidence,
  Country,
  step_epidemic,
} from './game-engine';
import {
  initLegend,
  draw_map,
} from './map-plot';
import "./sass/default.scss";
import TimelineChart from './timeline-chart';



//---- State ------------------------------------------------------------------------------------------------------------------
class State {
  constructor() {
    this.regions = [];
    this.measures = new Measures();
    this.covid_pars = new DynParameters();
    this.step_no = 0;
    this.country = new Country();
    this.running = false;
  }
}

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



function initMeasures() {
  let cm = document.getElementById("countermeasures");
  Object.entries(gState.measures).forEach((e, i) => {
    const toggle = document.createElement('input');
    toggle.setAttribute('type', 'checkbox');
    toggle.setAttribute('id', `m${i}`);
    toggle.setAttribute('name', `measure${i}`);
    toggle.setAttribute('class', `custom-control-input`);
    toggle.setAttribute('value', e[0]);
    toggle.addEventListener('change', () => { toggleMeasure(e[0]); });
    const label = document.createElement('label');
    label.setAttribute('for', `m${i}`);
    label.setAttribute('class', 'custom-control-label');
    label.innerText = e[1].desc;
    const container = document.createElement('div');
    container.setAttribute('class', 'countermeasure custom-control custom-switch custom-switch-md')
    container.appendChild(toggle);
    container.appendChild(label);
    cm.appendChild(container);
  });
}
initMeasures();

function toggleMeasure(cb) {
  if (gState == null) { return; }
  gState.measures.toggle(cb);
}

function initParams() {
  let cm = document.getElementById("parameters");
  Object.entries(gState.covid_pars).forEach((e, i) => {
    const field = document.createElement('input');
    field.setAttribute('class', 'form-control form-control-sm');
    field.setAttribute('type', 'number');
    field.setAttribute('id', `p${i}`);
    field.setAttribute('step', '0.1');
    field.setAttribute('min', '0');
    field.setAttribute('max', e[1].def * 2);
    field.addEventListener('change', () => { changeParams(e[0], field.value); });
    field.setAttribute('value', e[1].value);
    const label = document.createElement('label');
    label.setAttribute('for', `p${i}`);
    label.innerText = e[1].desc;
    const container = document.createElement('div');
    container.setAttribute('class', 'parameter')
    container.appendChild(field);
    container.appendChild(label);
    cm.appendChild(container);
  });
}
initParams();

function changeParams(id, value) {
  if (gState == null) { return; }
  gState.covid_pars[id].value = parseFloat(value) || gState.covid_pars[id].def;
  console.log(gState.covid_pars);
}

//---- Map Rendering ----------------------------------------------------------------------------------------------------------
initLegend();

//---- Handle Simulation State ------------------------------------------------------------------------------------------------


function simulate_step(state) {
  state.step_no++;
  step_epidemic(state.country, state.regions, state.measures, state.covid_pars, 0.01);
}

//---- Load & Preprocess Data -------------------------------------------------------------------------------------------------

var incidence = [];
function findIncidence(ctag, def) {
  let incr = incidence.find(e => e.tag == ctag);
  if (incr == null)  {
    console.log("No match for tag ", ctag, " => set to default ", def);
    return def;
  } else {
    return incr.inc;
  }
}

d3.queue()
  .defer(d3.json, "data/landkreise_simplify200.geojson")
  .defer(d3.csv, "data/7T_Inzidenz_LK_22_1.csv", function (d) {
    incidence.push({ name: d.Landkreis, tag: d.LKNR, active: d.Anzahl, inc: d.Inzidenz })
  })
  .await(start_sim);

let timelineChart = null;

function start_sim(error, topo) {
  var regions = []
  topo.features.forEach(e => {
    let inc = findIncidence(e.properties.AGS, 115); // TODO: default incidence hardcoded to 115, should be average from CSV dataset
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
