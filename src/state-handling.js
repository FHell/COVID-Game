import {
  Measures,
  DynParameters,
  region_with_incidence,
  init_random_regions,
  Country,
  get_current,
  count,
  step_epidemic,
  none_step_epidemic
} from './game-engine';

// This file defines the game state, handles the intialization,
// and the steping forward of the state, including
// event handling

export class State {
  constructor() {
    this.regions = [];
    this.measures = new Measures();
    this.covid_pars = new DynParameters();
    this.step_no = 0; // now
    this.country = new Country();
    this.events = []
    this.messages = []
    this.topo = []
    this.scenario_max_length = 200
    this.start_no = 0; // scenario_start
  }
}

// Initializing from the RKI Data in geojson format using only population numbers and 7 day incidence.

export function init_state_inc(gState, data) {
  data.features.forEach(e => {
    let r = region_with_incidence(e.properties.EWZ, e.properties.cases7_per_100k, e.properties.AGS, e.properties.GEN)
    // for distance between regions
    // two passes to prevent expensive recalculation
    r.centerOfMass = turf.centerOfMass(e.geometry).geometry.coordinates;
    gState.regions.push(r);
  });

  // second pass ... finish up distance calculations
  gState.regions.forEach((src_r) => {
    gState.regions.forEach((dst_r, i) => {
      src_r.neighbours.push({ index: i, dist: turf.distance(src_r.centerOfMass, dst_r.centerOfMass) });
    });
  });

  for (let i = 0; i < 4; i++) {
    none_step_epidemic(gState.country, gState.regions, gState.measures, gState.covid_pars);
  }

  gState.topo = data;
  gState.country.total = count((reg) => reg.total, gState.regions)
}

export function init_state_0(gState, data) {
  data.features.forEach(e => {
    let r = region_with_incidence(e.properties.EWZ, 0, e.properties.AGS, e.properties.GEN)
    // for distance between regions
    // two passes to prevent expensive recalculation
    r.centerOfMass = turf.centerOfMass(e.geometry).geometry.coordinates;
    gState.regions.push(r);
  });

  // second pass ... finish up distance calculations
  gState.regions.forEach((src_r) => {
    gState.regions.forEach((dst_r, i) => {
      src_r.neighbours.push({ index: i, dist: turf.distance(src_r.centerOfMass, dst_r.centerOfMass) });
    });
  });

  gState.topo = data;
  gState.country.total = count((reg) => reg.total, gState.regions)
}


// Random initialization

export function init_state_random(gState, events){
  // Initialize a baseline scenario without any covid.
  gState.regions = init_random_regions()
  gState.country.total = count((reg) => reg.total, gState.regions)
  gState.events = events
  return gState
}

// State stepping forward

export function step_state(state) {
  for (let e of state.events) {
    if (e.trigger(state)) {e.action_on(state); state.messages.push(e.news_item)}
  }
  // if (state.step_no < state.scenario_max_length) // Take this out for now, as it overlaps with MAX_DAYS handling in main.js
  state.step_no++;
  step_epidemic(state.country, state.regions, state.measures, state.covid_pars, 0.01);
  
}

export function simulate_full_scenario(state, cb = (s) => null){
  while (state.step_no < state.scenario_max_length) {
    step_state(state);
    cb(state);
  }
}

export class DynParEvent{
  constructor(step_no, field, value, news_item) {
    this.step_no = step_no
    this.value = value
    this.field = field
    this.news_item = news_item
  }

  trigger(state) {
    return state.step_no == this.step_no
  }

  action_on(state) {
    state.covid_pars[this.field].value = this.value
    console.log(this.news_item)
    console.log(`Set ${this.field} to ${this.value}`)
  }
}

// Testing and logging.

export function log_state(s) {
  console.log(s.country.global_tti, [s.country.seven_d_incidence, s.country.cumulative_deaths, s.country.S].map(get_current))
}

function self_test() {
  let state = new State();
  state.scenario_max_length = 12;
  let events = [new DynParEvent(1, "bck_rate", 3., "Stuff happening in neighbouring country, background infection rate increase."),
            new DynParEvent(10, "mu", 3.5, "Mutation increases base reproduction rate of virus")];

  init_state_random(state, events);
  simulate_full_scenario(state, log_state);
}

// self_test();