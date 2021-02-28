
class State {
  constructor() {
    this.regions = [];
    this.measures = new Measures();
    this.covid_pars = new DynParameters();
    this.step_no = 0;
    this.country = new Country();
    this.events = []
    this.topo = []
    this.scenario_max_length = 200
  }
}

function init_state_data(gState, topo, data) {
  gState.topo = topo
  // and more...
}

function init_state_0(gState, events){
  // Initialize a baseline scenario without any covid.
  gState.events = events
  return gState
}

function step_state(state) {
  for (e of state.events) {
    if (e.trigger(state)) {e.action_on(state)}
  }
  state.step_no++;
  step_epidemic(state.country, state.regions, state.measures, state.covid_pars, 0.01);
}

function simulate_full_scenario(state, cb = (state) => null){
  while (state.step_no < state.scenario_max_length) {
    step_state(state);
    cb(state);
  }
}

class DynParEvent{
  constructor(step_no, field, value) {
    this.step_no = step_no
    this.value = value
    this.field = field
  }

  trigger(state) {
    return state.step_no == this.step_no
  }

  action_on(state) {
    state.covid_pars[this.field].value = this.value
    console.log(`Set ${this.field} to ${this.value}`)
  }
}


function self_test() {
  state = new State();
  events = [new DynParEvent(1, "theta", 3.), new DynParEvent(10, "mu", 3.5)];

  init_state_0(state, events);
  simulate_full_scenario(state, (state) => console.log(state));
}

self_test();