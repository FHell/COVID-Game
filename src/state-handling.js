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
    this.travel_model = []
    this.scenario_max_length = 200
    this.start_no = 0; // scenario_start

  }
}

// Initializing from the RKI Data in geojson format using only population numbers and 7 day incidence.

export function init_state_inc(gState, data) {
  let LK_data = data[0]
  let travel_model = data[1]
  LK_data.features.forEach(e => {
    let r = region_with_incidence(e.properties.EWZ, e.properties.cases7_per_100k, e.properties.AGS, e.properties.GEN)
    // // for distance between regions
    // // two passes to prevent expensive recalculation
    // r.centerOfMass = turf.centerOfMass(e.geometry).geometry.coordinates;
    gState.regions.push(r);
  });

  // // second pass ... finish up distance calculations
  // gState.regions.forEach((src_r) => {
  //   gState.regions.forEach((dst_r, i) => {
  //     src_r.neighbours.push({ index: i, dist: turf.distance(src_r.centerOfMass, dst_r.centerOfMass) });
  //   });
  // });

  gState.start_no = 7

  for (let i = 0; i < gState.start_no; i++) {
    none_step_epidemic(gState.country, gState.regions, gState.measures, gState.covid_pars);
  }

  gState.topo = LK_data;
  gState.travel_model = travel_model;
  gState.country.total = count((reg) => reg.total, gState.regions)
}

export function init_state_0(gState, data) {
  let LK_data = data[0]
  let travel_model = data[1]

  LK_data.features.forEach(e => {
    let r = region_with_incidence(e.properties.EWZ, 0, e.properties.AGS, e.properties.GEN)
    gState.regions.push(r);
  });

  gState.topo = LK_data;
  gState.travel_model = travel_model;
  gState.country.total = count((reg) => reg.total, gState.regions)
}

// Inital state for 2 years of Covid

export function init_state_2y(gState, data) {
  init_state_0(gState, data);

  gState.scenario_max_length = 365 * 2;
  gState.start_no = 0;


  gState.events = [
    new DynParEvent(1, "bck_rate", 0.001, "January 1st, novel virus reported."),
    new DynParEvent(20, "bck_rate", 0.005, "January 20th, infected people have started travelling into the country in significant numbers."),
    new ToggleTTIEvent(30, "Starting Trace and Isolate Program focusing on people coming in from affected regions."),
    new DynParEvent(31+24, "bck_rate", 0.1, "February 24th, the virus is spreading through neighbouring countries, full blown arrival here is only a matter of time now."),
    new SetCMLevelEvent(31+26, 1, "First counter measures are taken. Initial focus is to slow down the virus until more is known."),
    new SetCMLevelEvent(31+30, 2, "As cases continue to rise measures are intensified."),
    new SetCMLevelEvent(31+30+10, 3, "As cases continue to rise measures are intensified."),
    new SetCMLevelEvent(31+30+20, 4, "20th of March, a a strong set of measures is taken."),
    new ToggleHL20Event(180, "Hard lockdown for >20 in effect."),
    new DynParEvent(365, "bck_rate_m", 5., "January 1st, B.1.1.7 mutation appears among travelers coming into Germany."),
    new DynParEvent(380, "vac_rate", 0.001, "Vaccinations starting slowly."),
    new SetCMLevelEvent(400, 4, "Increasing counter measures."),
    new DynParEvent(440, "vac_rate", 0.01, "Vaccinations picking up steam."),
    ];
}

// Random initialization

export function init_state_random(gState, events){
  // Initialize a baseline scenario without any covid.
  // only use for testing, can't be plotted!
  gState.regions = init_random_regions()
  gState.country.total = count((reg) => reg.total, gState.regions)
  gState.events = events
  return gState
}

// State stepping forward

export function step_state(state, interactive_mode) {
  for (let e of state.events) {
    if (e.trigger(state, interactive_mode)) {e.action_on(state); state.messages.push("Day " + state.step_no + ": " + e.news_item)}
  }
  // if (state.step_no < state.scenario_max_length) // Take this out for now, as it overlaps with MAX_DAYS handling in main.js
  state.step_no++;
  step_epidemic(state.country, state.regions, state.measures, state.covid_pars, state.travel_model);
  
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

  trigger(state, interactive_mode) {
    return state.step_no == this.step_no
  }

  action_on(state) {
    state.covid_pars[this.field].value = this.value
    console.log(this.news_item)
    console.log(`Set ${this.field} to ${this.value}`)
  }
}

export class ToggleHL20Event{
  constructor(step_no, news_item) {
    this.step_no = step_no
    this.news_item = news_item
  }

  trigger(state, interactive_mode) {
    return (state.step_no == this.step_no) && interactive_mode
  }

  action_on(state) {
    state.measures.hard_ld_inc.active = !state.measures.hard_ld_inc.active
    console.log(this.news_item)
    console.log(`Hard lockdown at 20 is ${state.measures.hard_ld_inc.active}`)
  }
}


export class ToggleTTIEvent{
  constructor(step_no, news_item) {
    this.step_no = step_no
    this.news_item = news_item
  }

  trigger(state, interactive_mode) {
    return (state.step_no == this.step_no) && interactive_mode
  }

  action_on(state) {
    state.measures.test_trace_isolate.active = !state.measures.test_trace_isolate.active
    console.log(this.news_item)
    console.log(`TTI is ${state.measures.test_trace_isolate.active}`)
  }
}


export class SetCMLevelEvent{
  constructor(step_no, lvl, news_item) {
    this.step_no = step_no
    this.news_item = news_item
    this.lvl = lvl
  }

  trigger(state, interactive_mode) {
    return (state.step_no == this.step_no) && interactive_mode
  }

  action_on(state) {
    state.measures.meas_lvl = this.lvl
    console.log(this.news_item)
    console.log(`Measures at  ${this.lvl}`)
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
