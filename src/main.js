import {
  possible_measures,
  cov_pars,
  region_with_incidence,
  Measure_State,
  Country,
  avg7_incidence,
  step_epidemic,
} from './covid-game-V2';
import "./sass/default.scss";

//---- Controls ---------------------------------------------------------------------------------------------------------------
var slider = document.getElementById("cd");
var output = document.getElementById("cdo");
output.innerHTML = slider.value;
slider.disable;

var running = false;  // TODO: this should be in State
var runner = document.getElementById("run");
function toggleRunning() {
  running = !running;
  runner.innerHTML = running ? "Pause" : "Run";
}

var runButton = document.getElementById("run");
runButton.addEventListener('click', toggleRunning);

function slider_set_value(value) {
  output.innerHTML = value;
  slider.value = value;
}

var gState = null;

function createElementFromHTML(html) {
  let div = document.createElement('div');
  div.innerHTML = html.trim();
  return div;
}

function initMeasures() {
  let cm = document.getElementById("cm");
  Object.entries(possible_measures).forEach((e, i) => {
    const toggle = document.createElement('input');
    toggle.setAttribute('type', 'checkbox');
    toggle.setAttribute('id', `m${i}`);
    toggle.setAttribute('name', `measure${i}`);
    toggle.setAttribute('class', `switch`);
    toggle.setAttribute('value', e[0]);
    toggle.addEventListener('change', () => { toggleMeasure(e[0]); });
    const label = document.createElement('label');
    label.setAttribute('for', `m${i}`);
    label.innerText = e[1].desc;
    const container = document.createElement('div');
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
  let cm = document.getElementById("param");
  Object.entries(cov_pars).forEach((e, i) => {
    const field = document.createElement('input');
    field.setAttribute('class', 'textfield');
    field.setAttribute('type', 'number');
    field.setAttribute('id', `p${i}`);
    field.setAttribute('step', '0.1');
    field.setAttribute('min', '0');
    field.setAttribute('max', '1');
    field.addEventListener('change', () => { changeParams(e[0], field.value); });
    field.setAttribute('value', e[1].value);
    const label = document.createElement('label');
    label.setAttribute('for', `p${i}`);
    label.innerText = e[1].desc;
    const container = document.createElement('div');
    container.appendChild(field);
    container.appendChild(label);
    cm.appendChild(container);
  });
}
initParams();

function changeParams(id, value) {
  if (gState == null) { return; }
  cov_pars[id].value = parseFloat(value) || cov_pars[id].def;
  console.log(cov_pars);
}

//---- Map Rendering ----------------------------------------------------------------------------------------------------------
var svg = d3.select("svg");
var svg_width = +svg.property("clientWidth");
var svg_height = +svg.property("clientHeight");

// Map and projection
var path = d3.geoPath();
var projection = d3.geoMercator()
  .scale(2200)
  .center([12, 52])
  .translate([svg_width / 2, svg_height / 2]);

// Data and color scale
var data = d3.map();
var legendValues = [5, 25, 50, 100, 150, 200, 300, 400];
var colorScale = d3.scaleThreshold()
  .domain(legendValues)
  .range(d3.schemeOrRd[legendValues.length + 1]);

function initLegend() {
  let cm = document.getElementById('legend');
  var firstLegendString = '< '.concat(legendValues[0].toString());
  cm.appendChild(createElementFromHTML(
    `<span class="legendspan" style="background-color:${colorScale(legendValues[0] - 1)};"></span> <label >${firstLegendString}</label><br>`
  ));
  for (var i = 1; i < legendValues.length; i++) {
    var legendString = ''.concat(legendValues[i - 1].toString(), ' - ', legendValues[i].toString());
    cm.appendChild(createElementFromHTML(
      `<span class="legendspan" style="background-color:${colorScale(legendValues[i] - 1)};"></span> <label >${legendString}</label><br>`
    ))
  }
  var lastLegendString = '> '.concat(legendValues[legendValues.length - 1].toString());
  cm.appendChild(createElementFromHTML(
    `<span class="legendspan" style="background-color:${colorScale(legendValues[legendValues.length - 1])};"></span> <label >${lastLegendString}</label><br>`
  ));
}
initLegend();

function draw_map_d3(topo, fill_fn) {
  // TODO: This recreates all geometry, we should only update the final fill state.
  svg.selectAll("g").remove();
  svg.append("g")
    .selectAll("path")
    .data(topo.features)
    .enter()
    .append("path")
    .attr("d", d3.geoPath().projection(projection))     // draw each country
    .attr("fill", fill_fn);                             // set the color of each country
}

//---- timelines_plot ---------------------------------------------------------------------------------------------------------
var timeline_data1 = [
  { ser1: 0.3, ser2: 4 },
  { ser1: 2, ser2: 16 },
  { ser1: 3, ser2: 8 }
];
var timeline_plot_change_duration = 1;
// set the dimensions and margins of the graph
var timeline_margin = { top: 10, right: 30, bottom: 30, left: 50 },
  width = 460 - timeline_margin.left - timeline_margin.right,
  height = 400 - timeline_margin.top - timeline_margin.bottom;

// append the svg object to the body of the page
var timeline_svg = d3.select("#timeline_plot")
  .append("svg")
  .attr("width", width + timeline_margin.left + timeline_margin.right)
  .attr("height", height + timeline_margin.top + timeline_margin.bottom)
  .append("g")
  .attr("transform",
    "translate(" + timeline_margin.left + "," + timeline_margin.top + ")");

// Initialise a X axis:
var timeline_x = d3.scaleLinear().range([0, width]);
var timeline_xAxis = d3.axisBottom().scale(timeline_x);
timeline_svg.append("g")
  .attr("transform", "translate(0," + height + ")")
  .attr("class", "myXaxis")

// Initialize an Y axis
var timeline_y = d3.scaleLinear().range([height, 0]);
var timeline_yAxis = d3.axisLeft().scale(timeline_y);
timeline_svg.append("g")
  .attr("class", "myYaxis")

// Create a function that takes a dataset as input and update the plot:
function update_timeline(data_input) {
  data = [];
  for (var i = 0; i < data_input.length; i++) {
    data.push({ day: i, value: data_input[i] });
  }

  // Create the X axis:
  timeline_x.domain([0, d3.max(data, function (d) { return d.day })]);
  timeline_svg.selectAll(".myXaxis").transition()
    .duration(timeline_plot_change_duration)
    .call(timeline_xAxis);

  // create the Y axis
  timeline_y.domain([0, d3.max(data, function (d) { return d.value })]);
  timeline_svg.selectAll(".myYaxis")
    .transition()
    .duration(timeline_plot_change_duration)
    .call(timeline_yAxis);

  // Create a update selection: bind to the new data
  var timeline_u = timeline_svg.selectAll(".lineTest")
    .data([data], function (d) { return d.day });

  // Update the line
  timeline_u
    .enter()
    .append("path")
    .attr("class", "lineTest")
    .merge(timeline_u)
    .transition()
    .duration(timeline_plot_change_duration)
    .attr("d", d3.line()
      .x(function(d) { return timeline_x(d.day); })
      .y(function(d) { return timeline_y(d.value); }))
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2.5)
}

//---- Handle Simulation State ------------------------------------------------------------------------------------------------

class State {
  constructor(regions, measures = new Measure_State()) {
    this.regions = regions;
    this.measures = measures;
    this.step_no = 0;
    this.country = new Country()
  }
}

function draw_map(topo, state) {
  draw_map_d3(topo, function (f) {
    let ctag = f.properties.AGS;
    let cr = state.regions.find(e => e.tag == ctag);
    return colorScale(avg7_incidence(cr));
  });
}

function simulate_step(state) {
  state.step_no++;
  step_epidemic(state.country, state.regions, state.measures, 0.01);
}

function draw_step(topo, state) {
  if (state.step_no >= slider.max) { running = false; }
  if (!running) { return; }

  simulate_step(state);
  draw_map(topo, state);
  update_timeline(state.country.I);

  slider_set_value(state.step_no)
  console.log("Rendered state", state);
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


  gState = new State(regions);
  console.log("Initial State = ", gState);

  draw_map(topo, gState);

  console.log("done");

  // TODO: find out how to trigger and stop this timer on demand, right now we just
  //       keep up "the beat" and decide to do breaks if needed.
  setInterval(draw_step, 1000, topo, gState);
}
