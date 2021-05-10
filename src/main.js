import {
  State,
  step_state
} from './state-handling.js';
import MapPlot from './map-plot';
import "./sass/default.scss";
import TimelineChart from './timeline-chart';
import TimelineChartSelector from './timeline-chart-selector';
import ScenarioSelector from './scenario-selector';

//---- Controls ---------------------------------------------------------------------------------------------------------------
var running = false;  // TODO: this should be in State
const MAX_DAYS = 200;
var runner = document.getElementById("run");
var tti_dial = document.getElementById("tti_dial");
var hosp_dial = document.getElementById("hosp_dial");
var vac_dial = document.getElementById("vac_dial");

function updateDials(state){
  tti_dial.innerHTML = state.country.global_tti
  hosp_dial.innerHTML = "0" // let hos = N_total * dyn_pars.hospital_capacity.value / ((1 - v_rate) * I)
  vac_dial.innerHTML = state.country.ratio_vac
}

const RunButtonContents = {
  PAUSED: "<i class='icon ic-run'></i> Run the simulation",
  RUNNING: "<i class='icon ic-pause'></i> Pause the simulation",
}
function updateRunButton() {
  runner.innerHTML = running ? RunButtonContents.RUNNING : RunButtonContents.PAUSED;
}
function toggleRunButton() {
  running = !running;
  updateRunButton();
}

var runButton = document.getElementById("run");
runButton.addEventListener('click', toggleRunButton);
updateRunButton();

var reseter = document.getElementById("reset");
reseter.innerHTML = "[Reset]"
function clickResetButton() {
  running = false;
  updateRunButton();
  gState = new State();
  timelineSelector.updateState(gState);
  scenarioSelector.updateState(gState);
  mapPlot.state = gState;
  scenarioSelector.initScenario(gState);
  renderState(gState)
  console.log("Reset")
}

var resetButton = document.getElementById("reset");
resetButton.addEventListener('click', clickResetButton);



var forward = document.getElementById("forward");
forward.innerHTML = "[Forward]"
function clickForwardButton() {
  running = false;
  while (gState.step_no < MAX_DAYS) {
      step_state(gState);
      updateProgressBar(gState.step_no);
    }
  timelineChart.update();
  mapPlot.update();
  console.log("Rendered state", gState);
}

var forwardButton = document.getElementById("forward");
forwardButton.addEventListener('click', clickForwardButton);



function updateProgressBar(day) {
  $('#gameProgressDay').html(`${day} ${day === 1 ? 'day' : 'days'}`);
  $('#gameProgress .progress-bar').css('width', `${(day / MAX_DAYS) * 100}%`);
}

function renderState(state) {
  updateDials(state);
  timelineChart.update();
  mapPlot.update();
  updateProgressBar(state.step_no);
  // console.log("Rendered state", state);
  console.log("Reset")
}

var gState = new State();

function initMeasures() {
  let cm = document.getElementById("countermeasures");

  const $lockdownLvSlider = $('<input type="range" class="form-control-range mb-2">')
    .attr({
      value: 0,
      min: 0,
      max: 4,
      step: 1
    })
    .appendTo(cm);

  const $lockdownLvLegend = $('<div class="mb-4">')
    .appendTo(cm);

  $lockdownLvSlider.on('change', () => {
    $lockdownLvLegend.text(`Level ${$lockdownLvSlider.val()}`);
    if (gState == null) { return; }
    gState.measures.meas_lvl = $lockdownLvSlider.val();  
    $lockdownLvLegend.text(gState.measures.meas[gState.measures.meas_lvl].desc);
  }).change();

  Object.entries(gState.measures).filter((m) => {console.log(m[1]); console.log(m[1].render); return m[1].render == true}).forEach((e, i) => {
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
  let $cm = $("#parameters");
  const $table = $('<table class="table table-bordered table-sm"></table>')
    .append($('<tbody></tbody>'))
    .appendTo($cm);
  Object.entries(gState.covid_pars).forEach((e, i) => {
    const $container = $('<tr class="parameter"></tr>')
      .appendTo($table);

    const $label = $('<label></label>')
      .attr('for', `p${i}`)
      .text(e[1].desc)
      .appendTo($('<td></td>').appendTo($container));

    const $field = $('<input class="form-control form-control-sm">')
      .attr('type', 'number')
      .attr('id', `p${i}`)
      .attr('step', 0.1)
      .attr('min', 0.)
      .attr('max', 100.)
      .on('change', () => { changeParams(e[0], $field.val()); })
      .val(e[1].value)
      .appendTo($('<td></td>').appendTo($container));
  });
}
initParams();

function changeParams(id, value) {
  if (gState == null) { return; }
  gState.covid_pars[id].value = parseFloat(value) || gState.covid_pars[id].def;
  console.log(gState.covid_pars);
}

//---- Load & Preprocess Data -------------------------------------------------------------------------------------------------

d3.queue()
  .defer(d3.json, "data/RKI_Corona_Landkreise.geojson")
  .await(start_sim);

let timelineChart = null;
let timelineSelector = null;
let scenarioSelector = null;
let mapPlot=null;

function coreLoop(state) {
  if (state.step_no > MAX_DAYS) { running = false; }
  if (running) {
    step_state(state);
    renderState(state);
  }

  setTimeout(coreLoop, 300, gState); // This can't be state because we swap out the global gState for a new State on reset,
  // and state would continue to reference the old global...
};

function start_sim(error, data) {
  // init_state_inc(gState, data);
  // init_state_0(gState, data);

  // console.log("Initial State = ", gState);

  timelineChart = new TimelineChart($('#charts')[0], gState.country.I);
  timelineSelector = new TimelineChartSelector(
    $('#chart_selector')[0], gState, timelineChart
  );
  scenarioSelector = new ScenarioSelector(
    $('#scenario_selector')[0], gState, data, clickResetButton);

  mapPlot = new MapPlot($('#mapPlot')[0], gState.topo, gState);
  mapPlot.draw();
  console.log("done");

  renderState(gState);

  setTimeout(coreLoop, 300, gState);
}
