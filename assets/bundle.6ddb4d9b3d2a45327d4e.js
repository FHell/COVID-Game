/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/sass/default.scss":
/*!*******************************!*\
  !*** ./src/sass/default.scss ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/covid-game-V2.js":
/*!******************************!*\
  !*** ./src/covid-game-V2.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Country": () => (/* binding */ Country),
/* harmony export */   "region_with_incidence": () => (/* binding */ region_with_incidence),
/* harmony export */   "cov_pars": () => (/* binding */ cov_pars),
/* harmony export */   "possible_measures": () => (/* binding */ possible_measures),
/* harmony export */   "Measure_State": () => (/* binding */ Measure_State),
/* harmony export */   "step_epidemic": () => (/* binding */ step_epidemic),
/* harmony export */   "avg7_incidence": () => (/* binding */ avg7_incidence)
/* harmony export */ });
/*
The overall design is: We have a bunch of regions with exchange between them.
These Regions follow some stochastic dynamic. We have countermeasures that
modify this dynamics.

Effects we want to include:
- Test and trace with diminishing efficiency at higher efficiency
- Increasing mortality/severe symptoms when the health system is over capacity
- Total number of people who have died so far/who are suffering long term consequences
- Vaccinations
- B117 Mutation
- Introduction of new cases from abroad
- Social distancing/lockdown
- closing companies

First sketch to think about the interface:
Take a stochastic SIR model scale 1 to 100 with random travel between regions.
Make the measures modify R and travel probability.



*/

function binom(N, p){
    let suc = 0
    for (let n = 0; n < N; n++) {
        if (Math.random() < p) {suc++}
    }
    return suc
}

function neg_binom(r, p){
    let suc = 0
    let fai = 0
    while (fai < r) {
        if (Math.random() < p) {suc++} else {fai++}
    }
    return suc
}

class Region {

    constructor(N_S, N_E, N_I, N_Em, N_Im, N_R, N_total, trace_capacity, tag, name) {

        // These should be arrays
        this.S = N_S
        this.E = N_E
        this.I = N_I
        this.Em = N_Em
        this.Im = N_Im
        this.R = N_R

        this.total = N_total
        this.trace_capacity = trace_capacity

        this.travel_I = 0 // total traveling infected neighbours
        this.travel_Im = 0 // total traveling infected neighbours with mutant

        this.background_rate = 0.001
        this.tag = tag
        this.name = name
        this.neighbours = Array() // Needs to be populated later
    }
}

class Country {
    constructor() {

        // Here we can also save summary information that we want to show
        // like highscore data, number of people who died, number of
        // person-days in lockdown, etc...

        this.S = []
        this.E = []
        this.I = []
        this.Em = []
        this.Im = []
        this.R = []

        this.ratio_vac = 0
    }
}

function region_with_incidence(total, incidence, tag, name) {
    let I = [incidence / 100000 * total];
    let E = [I[0] * 0.7];
    let R = [0];
    let S = [total - I[0]];
    return new Region(S, E, I, [0], [0], R, total, total * 0.01, tag, name);
}

//-----------------------------------------------------------------------------------------------------------------------------
// Those are reflected in the frontend you can enter new ones, but leave the structure alone

const cov_pars = {
    R:      { value: 0.2, def: 0.2, desc: "Base r-rate" },
    Rm:     { value: 0.25, def: 0.25, desc: "Base r-rate(mutations)" },
    var:    { value: 0.8,  def: 0.8,  desc: "Variance of the infection process" },
    recov:  { value: 0.1,  def: 0.1,  desc: "recovery chance" },
    E_to_I: { value: 0.5,  def: 0.5,  desc: "exposed to infectious chance" }
};

const possible_measures = {
    gatherings_1000         : { desc: "Gatherings with up to max of 1000 people allowed" },
    gatherings_100          : { desc: "Gatherings with up to max of 100 people allowed" },
    gatherings_10           : { desc: "Gatherings with up to max of 10 people allowed" },
    schools_unis_closed     : { desc: "Schools and Universities are closed" },
    some_business_closed    : { desc: "Selected (high-traffic) buisnesses are closed" },
    all_business_closed     : { desc: "All non-essential buisnesses are closed" },
    test_trace_isolate      : { desc: "Trace & Isolate infected persons" },
    stay_at_home            : { desc: "Strict 'stay at home' orders" },
};

//-----------------------------------------------------------------------------------------------------------------------------

// Measures taken from slide
class Measure_State {
    constructor(){
        Object.assign(this, possible_measures);
        Object.keys(this).map(key => this[key].active = false);
    }

    toggle(key) {
        this[key].active = !this[key].active;
    }
}

// translate the current measures into a relative scaling of R and var
// To start with we assume they are proportional
function measure_effect(cm) {
    //console.log(cm);
    // This is how I interpret the slide. Might or might not be true:
    let r_mult = 1.
    if (cm.gatherings_1000.active) {r_mult *= 1 - 0.2}
    else if (cm.gatherings_100.active) {r_mult *= 1 - 0.25}
    else if (cm.gatherings_10.active) {r_mult *= 1 - 0.35}

    if (cm.schools_unis_closed.active) {r_mult *= 1 - 0.4}

    if (cm.some_business_closed.active) {r_mult *= 1 - 0.2}
    else if (cm.all_business_closed.active) {r_mult *= 1 - 0.3}

    if (cm.stay_at_home.active) {r_mult *= 1 - 0.1}

    return [r_mult, r_mult]
}

function tti_eff(infected, trace_capacity) {
    // rough model is Just dreamed up of test, trace, isolate efficiency,
    // (because I'm to lazy to read the papers more thoroughly):
    // if we can trace everyone we reduce R by 1/3rd
    // if not we reduce it by 1/3rd for the fraction traced and not at all for the rest.
    if (infected < trace_capacity) {return 0.66}
    else {return (0.66 * trace_capacity / infected + (infected - trace_capacity) / infected)}
}

function prob_round(x) {
    // This function rounds to the integer i below x with probability 1 - (x - i),
    // and to the integer above otherwise. In terms of linear expectation values
    // this is a smooth rounding function. :)
    let i = Math.floor(x)
    if (Math.random() < (x - i)) {return i + 1} else {return i}
}

function get_deltas(E, I, I_travel, r, variance, cov_pars, background) {
    // Both binomial and negative binomial become approximately normal for large size
    // parameter. Possible performance improvement for large epidemics is to approximate the sampling.

    let delta_E = 0 // newly exposed
    let delta_I = 0 // newly infected
    let delta_R = 0 // newly removed

    // Every exposed has an E_to_I probability to become infectious

    delta_I = binom(E, cov_pars.E_to_I.value)

    // The variance must always be larger than the mean in this model.
    //  The threshold 1.1 is arbitrary here, hopefully we wont hit this case with real parametrization.
    if (variance < 1.1 * r) {var var2 = 1.1 * r} else {var var2 = variance}

    // Every infectious in the region will cause a negative binomial distribution of new infected today.
    // The sum of N iid negative binomials is a negative binomial with size parameter scaled by N

    delta_E = binom(prob_round(I + I_travel + background), r)

    // There is a bug in the dynamics below. TODO: Need to investigate this tomorrow.

    // if (r == 0) {delta_E = 0} else {
    //     let p = 1 - r/var2
    //     let size = prob_round((I + I_travel + background) * (1 - p) / p)
    //     delta_E = neg_binom(size, p)
    // }

    delta_R = binom(I, cov_pars.recov.value)

    return [delta_E, delta_I, delta_R]
}

function local_step(reg, r_mult, var_mult, tti) {

    let now = reg.S.length - 1

    let s_adjust = reg.S[now] / reg.total

    if (reg.S[now] < 0) {console.log("Something went wrong, S went negative")}

    let local_r  = s_adjust * r_mult * cov_pars.R.value
    let local_rm = s_adjust * r_mult * cov_pars.Rm.value

    if (tti) {
        local_r  *= tti_eff(reg.I[now] + reg.Im[now], reg.trace_capacity)
        local_rm *= tti_eff(reg.I[now] + reg.Im[now], reg.trace_capacity)
    }

    let local_var = var_mult * cov_pars.var.value

    let deltas = get_deltas(reg.E[now], reg.I[now], reg.travel_I, local_r, local_var, cov_pars, reg.background_rate)

    let delta_E = deltas[0] // newly exposed
    let delta_I = deltas[1] // newly infectious
    let delta_R = deltas[2] // newly removed

    let deltas_m = get_deltas(reg.Em[now], reg.Im[now], reg.travel_Im, local_rm, local_var, cov_pars, reg.background_rate)

    let delta_Em = deltas_m[0] // newly exposed mutant
    let delta_Im = deltas_m[1] // newly infectious mutant
    let delta_Rm = deltas_m[2] // newly removed mutant

    // Handle the case when the last susceptible in a region become exposed:
    let c1 = reg.S[now] - delta_E - delta_Em

    if (c1 > 0){
        reg.S.push(reg.S[now] - delta_E - delta_Em)
    }
    else {
        reg.S.push(0)
        delta_E = reg.S[now]
        delta_Em = 0
    }

    // Push to the data arrays
    reg.E.push(reg.E[now] + delta_E - delta_I)
    reg.Em.push(reg.Em[now] + delta_Em - delta_Im)
    reg.I.push(reg.I[now] + delta_I - delta_R)
    reg.Im.push(reg.Im[now] + delta_Im - delta_Rm)
    reg.R.push(reg.R[now] + delta_R + delta_Rm)
}


function step_epidemic(Country, Regions, curr_measures, travel) {

    // travel is the fraction of people from a region that travel to a neighbouring region
    // in our first approximation these are simply all regions within 100km and travel is a constant fraction.
    // these people cause infections at the place they travel to as well as at home.

    for (let reg of Regions) {
        let now = reg.S.length - 1;

        reg.travel_I = 0
        reg.travel_Im = 0
        for (let nei of reg.neighbours){
            if (nei.dist < 100 && reg != Regions[nei.index]) {
                reg.travel_I += Math.round(travel * Regions[nei.index].I[now])
                reg.travel_Im += Math.round(travel * Regions[nei.index].Im[now])
            }
        }
    }

    let r_var_mult = measure_effect(curr_measures)

    for (let reg of Regions) {
        local_step(reg, r_var_mult[0], r_var_mult[1], curr_measures.test_trace_isolate.active)
    }

    Country.S.push(count(S_now, Regions))
    Country.E.push(count(E_now, Regions))
    Country.I.push(count(I_now, Regions))
    Country.Em.push(count(Em_now, Regions))
    Country.Im.push(count(Im_now, Regions))
    Country.R.push(count(R_now, Regions))

    // debug output
    // let re = Regions[2]

    // let now = re.S.length - 1

    // let s_adjust = re.S[now] / re.total

    // let local_r  = s_adjust * r_var_mult[0] * cov_pars.R.value
    // console.log(tti_eff(re.I[now] + re.Im[now], re.trace_capacity), r_var_mult[0], local_r)
    // console.log(curr_measures.gatherings_1000.active)

}

function region_100k_u0_9_infected() {
    let total = 100000
    let trace_capacity = total * 0.01;
    let I = [Math.round(10 * Math.random())]
    let Im = [0]
    let E = [0]
    let Em = [0]
    let R = [0]
    let S = [total - I[0]]
    return new Region(S, E, I, Em, Im, R, total, trace_capacity, "000", "LK")
}

function connect_regions_randomly(Regions) {
    let n_reg = Regions.length
    for (let reg of Regions) {
        for (let n = 0; n < n_reg; n++)
            reg.neighbours.push({dist: Math.random() * 500, index: n})
    }
}

function get_current(field)         { return field[field.length - 1]; }
function count(proj, r)             { return r.reduce((a, v) => a + proj(v), 0); }

function exposed(reg)               { return get_current(reg.E) + get_current(reg.Em); }
function infectious(reg)            { return get_current(reg.I) + get_current(reg.Im); }
function infected(reg)              { return exposed(reg) + infectious(reg); }
function recovered(reg)             { return get_current(reg.R); }
function susceptible(reg)           { return get_current(reg.S); }
function total(reg)                 { return reg.total; }

function count_infectious(Regions)  { return count(infectious, Regions); }
function count_exposed(Regions)     { return count(exposed, Regions); }
function count_recovered(Regions)   { return count(recovered, Regions); }
function count_susceptible(Regions) { return count(susceptible, Regions); }

function S_now(reg)               { return get_current(reg.S); }
function E_now(reg)            { return get_current(reg.E); }
function I_now(reg)              { return get_current(reg.I); }
function Em_now(reg)            { return get_current(reg.Em); }
function Im_now(reg)              { return get_current(reg.Im); }
function R_now(reg)             { return get_current(reg.R); }



//
function average(arr)               { return arr.reduce((a, v) => a + v, 0) / arr.length; }

// TODO: fix the projections above so that we can use them here
function avg7_incidence(reg) {
    let c = 0, s = 0;
    for(let i = reg.I.length-1; i>=0; i--) {
        c++;
        s += ((reg.I[i] + reg.Im[i] + reg.E[i] + reg.Em[i]) / reg.total) * 100000;

        if (c>7) { break; }
    }
    return (s / c) || 0;
}

//tti = Test Trace Isolate

function tti_over_capacity(Regions){
    let tti = 0
    for (reg of Regions) {
        if (reg.I[reg.I.length - 1] + reg.Im[reg.Im.length - 1] > reg.trace_capacity) {tti += 1}
    }
    return tti
}

function tti_global_effectiveness(Regions){
    let tti_prevented = 0
    let n = Regions.length
    for (let reg of Regions) {
        let tti = tti_eff(infected(reg), reg.trace_capacity)
        let tti_max = tti_eff(0, reg.trace_capacity)
        tti_prevented += (1 - tti) / (1 - tti_max)
    }
    return tti_prevented / n
}

// First naive implementation, use projections once they can look into the past?
function get_timelines(Country){
    // ToDo: check that length Regions > 0
    let S = Country.S
    let E = Country.E
    let I = Country.I
    let Im = Country.Im
    let Em = Country.Em
    let R = Country.R
    return {S: S, E: E, I: I, Im: Im, Em: Em, R: R}
}

// Things that we really want to show in the front end:
// * Graphs of SEIR EmIm (and V once implemented) -> use get_timelines(Regions)
// * Overall test trace isolate effectiveness (also timeline?) -> use tti_global_effectiveness(Regions)

// Things we really want to show but that need a tiny bit of modeling:
// * Total counter of Deaths and Long Covid cases results in R (simple proportional to start with)
// * Total counter of people that went R while health system is overtaxed.

// Nice to haves:
// * On the map: Switch to mutation only.
// * On the map: Switch to tti effectiveness.
// * On the map: Switch to incidence rising/sinking.
// * Graph of how many people every person infects.
// * Change map to travel network.


function init_random_regions() {
    let Regions = []

    for (let n = 0; n < 420; n++) {
        Regions.push(region_100k_u0_9_infected())
    }

    connect_regions_randomly(Regions, 2000)
    return Regions
}

function log_reg(Regions){
    console.log([tti_global_effectiveness(Regions), count_susceptible(Regions), count_exposed(Regions), count_infectious(Regions), count_recovered(Regions)])
}
function log_country(country){
    console.log([S_now(country), E_now(country), I_now(country), R_now(country)])
}

function self_test() {

    let Regions = init_random_regions()
    let c_meas = new Measure_State()
    let country = new Country()

    for (let n = 0; n < 5; n++) {
        log_reg(Regions)

        step_epidemic(country, Regions, c_meas, 0.01)
    }

    console.log("Starting test and trace program")
    c_meas.test_trace_isolate.active = true

    for (let n = 0; n < 15; n++) {
        log_reg(Regions)

        step_epidemic(country, Regions, c_meas, 0.01)
    }
    console.log("Switching on all counter measures")

    c_meas.gatherings_1000.active = true
    c_meas.gatherings_100.active = true
    c_meas.gatherings_10.active = true
    c_meas.schools_unis_closed.active = true
    c_meas.some_business_closed.active = true
    c_meas.all_business_closed.active = true
    c_meas.test_trace_isolate.active = true
    c_meas.stay_at_home.active = true

    for (let n = 0; n < 25; n++) {
        log_reg(Regions)

        step_epidemic(country, Regions, c_meas, 0.01)
    }
    log_reg(Regions)
    log_country(country)
    console.log(get_timelines(country).S.length)

}

self_test();


/***/ }),

/***/ "./src/main.js":
/*!*********************!*\
  !*** ./src/main.js ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _covid_game_V2__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./covid-game-V2 */ "./src/covid-game-V2.js");
/* harmony import */ var _sass_default_scss__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./sass/default.scss */ "./src/sass/default.scss");
/* harmony import */ var _timeline_chart__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./timeline-chart */ "./src/timeline-chart.js");




//---- Controls ---------------------------------------------------------------------------------------------------------------
var slider = document.getElementById("cd");
var output = document.getElementById("cdo");
output.innerHTML = slider.value;
slider.disable;

var running = false;  // TODO: this should be in State
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
  let cm = document.getElementById("countermeasures");
  Object.entries(_covid_game_V2__WEBPACK_IMPORTED_MODULE_0__.possible_measures).forEach((e, i) => {
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
  Object.entries(_covid_game_V2__WEBPACK_IMPORTED_MODULE_0__.cov_pars).forEach((e, i) => {
    const field = document.createElement('input');
    field.setAttribute('class', 'form-control form-control-sm');
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
    container.setAttribute('class', 'parameter')
    container.appendChild(field);
    container.appendChild(label);
    cm.appendChild(container);
  });
}
initParams();

function changeParams(id, value) {
  if (gState == null) { return; }
  _covid_game_V2__WEBPACK_IMPORTED_MODULE_0__.cov_pars[id].value = parseFloat(value) || _covid_game_V2__WEBPACK_IMPORTED_MODULE_0__.cov_pars[id].def;
  console.log(_covid_game_V2__WEBPACK_IMPORTED_MODULE_0__.cov_pars);
}

//---- Map Rendering ----------------------------------------------------------------------------------------------------------
var svg = d3.select("svg");
var svg_width = 300;
var svg_height = 400;

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

//---- Handle Simulation State ------------------------------------------------------------------------------------------------

class State {
  constructor(regions, measures = new _covid_game_V2__WEBPACK_IMPORTED_MODULE_0__.Measure_State()) {
    this.regions = regions;
    this.measures = measures;
    this.step_no = 0;
    this.country = new _covid_game_V2__WEBPACK_IMPORTED_MODULE_0__.Country()
  }
}

function draw_map(topo, state) {
  draw_map_d3(topo, function (f) {
    let ctag = f.properties.AGS;
    let cr = state.regions.find(e => e.tag == ctag);
    return colorScale((0,_covid_game_V2__WEBPACK_IMPORTED_MODULE_0__.avg7_incidence)(cr));
  });
}

function simulate_step(state) {
  state.step_no++;
  (0,_covid_game_V2__WEBPACK_IMPORTED_MODULE_0__.step_epidemic)(state.country, state.regions, state.measures, 0.01);
}

function draw_step(topo, state) {
  if (state.step_no >= slider.max) { running = false; }
  if (!running) { return; }

  simulate_step(state);
  draw_map(topo, state);
  timelineChart.update();

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

let timelineChart = null;

function start_sim(error, topo) {
  var regions = []
  topo.features.forEach(e => {
    let inc = findIncidence(e.properties.AGS, 115); // TODO: default incidence hardcoded to 115, should be average from CSV dataset
    let r = (0,_covid_game_V2__WEBPACK_IMPORTED_MODULE_0__.region_with_incidence)(e.properties.destatis.population, inc, e.properties.AGS, e.properties.GEN)
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
  timelineChart = new _timeline_chart__WEBPACK_IMPORTED_MODULE_2__.default($('#charts')[0], gState.country.I);
}


/***/ }),

/***/ "./src/timeline-chart.js":
/*!*******************************!*\
  !*** ./src/timeline-chart.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ TimelineChart)
/* harmony export */ });
class TimelineChart {
  constructor(container, data) {
    this.container = container;
    this.$canvas = $('<canvas></canvas>')
      .attr('width', 400)
      .attr('height', 300)
      .appendTo(container);
    this.chart = new Chart(this.$canvas[0].getContext('2d'), {
      type: 'bar',
      data: {
        labels: Array(Math.max(data.length, 28)).fill(0).map((_, i) => i + 1),
        datasets: [{
          data,
          backgroundColor: '#ff5400',
          borderColor: '#d84d08',
          borderWidth: 1,
          datalabels: {
            color: '#fff',
            font: { size: 10 },
            anchor: 'end',
            align: 'top',
            clamp: true,
          },
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        tooltips: { enabled: false },
        hover: { mode: null },
        scales: {
          xAxes: [{
            gridLines: {
              color: '#000',
              zeroLineColor: '#000',
              drawOnChartArea: false,
            },
            ticks: {
              fontSize: 10,
              fontColor: '#000',
            },
            categoryPercentage: 1.0,
            barPercentage: 1.0,
          }],
          yAxes: [{
            gridLines: {
              color: '#b8b8b8',
              zeroLineColor: '#000',
            },
            ticks: {
              fontSize: 10,
              fontColor: '#000',
              callback: value => value.toLocaleString(),
              maxTicksLimit: 7,
              suggestedMax: 150000,
              suggestedMin: 0,
            },
          }],
        },
        animation: {
          duration: 300,
        },
        legend: { display: false },
      }
    });
  }

  update() {
    for (let i = this.chart.data.labels.length; i < this.chart.data.datasets[0].data.length; i += 1) {
      this.chart.data.labels.push(i + 1);
    }
    this.chart.update();
  }
}


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		if(__webpack_module_cache__[moduleId]) {
/******/ 			return __webpack_module_cache__[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	// startup
/******/ 	// Load entry module
/******/ 	__webpack_require__("./src/main.js");
/******/ 	// This entry module used 'exports' so it can't be inlined
/******/ })()
;
//# sourceMappingURL=bundle.6ddb4d9b3d2a45327d4e.js.map