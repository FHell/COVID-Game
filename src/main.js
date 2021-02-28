import {
  State,
  step_state,
  init_state_inc
} from './state-handling.js';
import MapPlot from './map-plot';
import "./sass/default.scss";
import TimelineChart from './timeline-chart';
import TimelineChartSelector from './timeline-chart-selector';

//---- Controls ---------------------------------------------------------------------------------------------------------------
var running = false;  // TODO: this should be in State
const MAX_DAYS = 200;
var runner = document.getElementById("run");
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

function updateProgressBar(day) {
  $('#gameProgressDay').html(`${day} ${day === 1 ? 'day' : 'days'}`);
  $('#gameProgress .progress-bar').css('width', `${(day / MAX_DAYS) * 100}%`);
}

var gState = new State();

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
      .attr('step', '0.1')
      .attr('min', 0)
      .attr('max', e[1].def * 2)
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

function start_sim(error, data) {
  init_state_inc(gState, data)

  console.log("Initial State = ", gState);
  const mapPlot = new MapPlot($('#mapPlot')[0], gState.topo, gState);
  mapPlot.draw();
  console.log("done");

  const updateLoop = (state) => {
    if (state.step_no > MAX_DAYS) { running = false; }
    if (running) {
      step_state(state);
      timelineChart.update();
      mapPlot.update();
      updateProgressBar(state.step_no);
      console.log("Rendered state", state);
    }

    setTimeout(updateLoop, 300, gState);
  };
  setTimeout(updateLoop, 300, gState);

  timelineChart = new TimelineChart($('#charts')[0], gState.country.I);
  timelineSelector = new TimelineChartSelector(
    $('#chart_selector')[0], gState, timelineChart
  );
}
