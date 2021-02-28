import {
    Measures,
    DynParameters,
    region_with_incidence,
    Country,
    step_epidemic,
} from './game-engine';

import {
    draw_map,
} from './map-plot';

import TimelineChart from './timeline-chart';
//---- State ------------------------------------------------------------------------------------------------------------------
export class State {
    constructor() {
        this.regions = [];
        this.measures = new Measures();
        this.covid_pars = new DynParameters();
        this.step_no = 0;
        this.country = new Country();
        this.running = false;
        this.incidence = [];
        this.max_days = 200;
        this.timeline_chart = null;
        this.scenario = new Scenario();
    }
}


//---- Initialization --------------------------------------------------------------------------------------------------------- 
function initMeasures(gState) {
    let cm = document.getElementById("countermeasures");
    Object.entries(gState.measures).forEach((e, i) => {
        const toggle = document.createElement('input');
        toggle.setAttribute('type', 'checkbox');
        toggle.setAttribute('id', `m${i}`);
        toggle.setAttribute('name', `measure${i}`);
        toggle.setAttribute('class', `custom-control-input`);
        toggle.setAttribute('value', e[0]);
        toggle.addEventListener('change', () => { toggleMeasure(gState, e[0]); });
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

function toggleMeasure(gState, cb) {
    if (gState == null) { return; }
    gState.measures.toggle(cb);
}

function initParams(gState) {
    let cm = document.getElementById("parameters");
    Object.entries(gState.covid_pars).forEach((e, i) => {
        const field = document.createElement('input');
        field.setAttribute('class', 'form-control form-control-sm');
        field.setAttribute('type', 'number');
        field.setAttribute('id', `p${i}`);
        field.setAttribute('step', '0.1');
        field.setAttribute('min', '0');
        field.setAttribute('max', e[1].def * 2);
        field.addEventListener('change', () => { changeParams(gState, e[0], field.value); });
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

function changeParams(gState, id, value) {
    if (gState == null) { return; }
    gState.covid_pars[id].value = parseFloat(value) || gState.covid_pars[id].def;
    console.log(gState.covid_pars);
}


export function init_Params_Measures(gState) {
    initMeasures(gState);
    initParams(gState);
}


//---- Handle Simulation State ------------------------------------------------------------------------------------------------
export function simulate_step(state) {
    state.step_no++;
    step_epidemic(state.country, state.regions, state.measures, state.covid_pars, 0.01);
}

export function findIncidence(gState, ctag, def) {
    let incr = gState.incidence.find(e => e.tag == ctag);
    if (incr == null) {
        console.log("No match for tag ", ctag, " => set to default ", def);
        return def;
    } else {
        return incr.inc;
    }
}

function updateProgressBar(gState) {
    var day = gState.step_no;
    $('#gameProgressDay').html(`${day} ${day === 1 ? 'day' : 'days'}`);
    $('#gameProgress .progress-bar').css('width', `${(day / gState.max_days) * 100}%`);
}

export function start_sim(error, topo, gState) {
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
    // events.day_of_event = [10];
    // events.actions = [1];
    // init_scenario(gState);
    console.log("done");

    const updateLoop = (topo, state) => {
        if (state.step_no > state.max_days) { gState.running = false; }
        if (gState.running) {
            scenario_step(topo,state);
        }

        setTimeout(updateLoop, 1000, topo, gState);
    };
    setTimeout(updateLoop, 1000, topo, gState);
    gState.timeline_chart = new TimelineChart($('#charts')[0], gState.country.I);
}



//---- Scenarios ------------------------------------------------------------------------------------------------

class Events {
    constructor(){
        this.day_of_event = [3];
        this.actions = [1];
    }
}

class Scenario {
    constructor() {
        this.events = new Events();
    }
}


function init_scenario(gState, events) {
    gState.scenario.events = events;
}

function scenario_action(gState) {
    var events = gState.scenario.events;
    if (events.day_of_event.includes(gState.step_no)) {
        // if (events[events[events.day_of_event.indexOf(gState.step_no)]] == 1) {
            console.log("here")
            toggleMeasure(gState, "gatherings_1000");
            gState.measures.gatherings_10.active = true;
            gState.measures.gatherings_100.active = true;
            gState.measures.gatherings_1000.active = true;
            gState.measures.schools_unis_closed.active = true;
            gState.measures.some_business_closed.active = true;
            gState.measures.all_business_closed.active = true;
            gState.measures.test_trace_isolate.active = true;
            gState.measures.stay_at_home.active = true;
    // }
    }
}

function scenario_step(topo,state) {
    scenario_action(state);
    simulate_step(state);
    draw_map(topo, state);
    state.timeline_chart.update();
    updateProgressBar(state);
    console.log("Rendered state", state);
}