// Core data structures

// We have the state of the Country and of the individual regions first.
// These contain the timelines for various quantities, as well as some
// basic information attached to either.

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
        
        this.ratio_vac = []
        this.deaths = []
    }
}

class Region {
    
    constructor(N_S, N_E, N_I, N_Em, N_Im, N_R, N_total, tag, name) {
        
        // These should be arrays        
        this.S = N_S
        this.E = N_E
        this.I = N_I
        this.Em = N_Em
        this.Im = N_Im
        this.R = N_R

        this.total = N_total

        this.travel_I = 0 // total traveling infected neighbours
        this.travel_Im = 0 // total traveling infected neighbours with mutant

        this.tag = tag
        this.name = name
        this.neighbours = Array() // Needs to be populated later
    }
}

// An important way to initialize a region is given an incidence and a total number of people

function region_with_incidence(total, incidence, tag, name) {
    let I = [incidence / 100000 * total];
    let E = [I[0] * 0.7];
    let R = [0];
    let S = [total - I[0]];
    return new Region(S, E, I, [0], [0], R, total, tag, name);
}


// We then have the parameters for the disease and death model, as well as some properties derived from the parameters.

class DynParameters {
    constructor() {
        // The parameters of the disease and the vaccination campaign

        // Disease dynamics
        this.mu = { value: 0.3, def: 0.3, desc: "Base R0: Number of people an infected infects on average." }
        this.mu_m = { value: 0.4, def: 0.4, desc: "Base R0 for Mutant: Number of people someone infected by the mutant infects on average." }
        this.I_to_R = { value: 0.1,  def: 0.1,  desc: "Daily rate of end of infectiousness (leading to recovery or death)." }
        this.E_to_I = { value: 0.5,  def: 0.5,  desc: "Daily rate of infection breaking out among those carrying the virus (they become infectious for others)." }
        this.k = { value: 0.1,  def: 0.1,  desc: "Overdispersion: Not everyone infects exactly R0 people, this parameter controls how much the number of infected varies from person to person." }
        this.vac_rate = { value: 0.001,  def: 0.001,  desc: "Fraction of population vaccinated per day." }
        this.vac_eff = { value: 0.8,  def: 0.8,  desc: "Fraction of infections prevented by vaccination." }
        this.bck_rate = { value: 0.5,  def: 0.5,  desc: "Average number of infected coming into each region per day from outside the country." }
        this.bck_rate_m = { value: 0.5,  def: 0.5,  desc: "Average number of mutant infected coming into each region per day from outside the country." }
        
        // Death model
        this.hospital_capacity = { value: 0.001,  def: 0.001,  desc: "ICU capacity as a fraction of population." }
        this.death_rate_1 = { value: 0.01,  def: 0.01,  desc: "Fraction of deaths for people within hospital capactity." }
        this.death_rate_2 = { value: 0.05,  def: 0.05,  desc: "Fraction of deaths for people beyond hospital capactity." }
        this.vulnerable = { value: 0.2,  def: 0.2,  desc: "Fraction of vulnerable in the population." }
        this.non_vul_dr = { value: 0.1,  def: 0.1,  desc: "Rate of serious complications/deaths among non-vulnerable population relative to overall population (this modifier gradually kicks in as the vulnerable get vaccinated)."}
    }
}


class DerivedProps {
    constructor(dyn_pars) {
        // Fomrulas not right yet...
        this.time_to_infectious = { value: 1 + (1 - dyn_pars.E_to_I) / dyn_pars.E_to_I, desc: "Average time until an infected person becomes infectious."}
        this.time_of_infectiousness = { value: 1 + (1 - dyn_pars.I_to_R) / dyn_pars.I_to_R, desc: "Average time a person is infectious."}
        // this.superspreader_20 = {value: dyn_pars.k, desc: "20% of people infect this fraction of the total amount of infected."}
    }
}


// The core dynamic of the SEIR model is given next in terms of binomial and negative binomial distributions
// Our negative binomial diefinition follows that of Wikipedia.

function binom(N, p){
    let suc = 0
    for (let n = 0; n < N; n++) {
        if (Math.random() < p) {suc++}
    }
    return suc
}

function neg_binom(r, p){
    if (p == 0.) {console.log("Negative binomial was called with p = 0"); return 0} // Convenient failure mode
    let suc = 0;
    let fai = 0;
    while (fai < r) {
        if (Math.random() < p) {suc++} else {fai++}
    }
    return suc
}

function get_deltas(E, I, I_travel, E_to_I, I_to_R, mu, k, v, background) {

    let delta_E = 0 // newly exposed
    let delta_I = 0 // newly infected
    let delta_R = 0 // newly removed

    delta_I = binom(E, E_to_I)
    delta_R = binom(I, I_to_R)

    // we need to get the paremters r and p from the mu and k which we specify / which the measures
    // affect directly.
    d_infect = ( 1 + (1 - dyn_pars.I_to_R) / dyn_pars.I_to_R )
    mu_d = mu / d_infect
    r = 1/k
    p = mu_d / (r + mu_d)

    I_eff = (1 - v) * (I + I_travel) + background
    size = prob_round(r * I_eff)
    delta_E = neg_binom(size, p)

    return [delta_E, delta_I, delta_R]
}


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


//-----------------------------------------------------------------------------------------------------------------------------
// Those are reflected in the frontend you can enter new ones, but leave the structure alone

// TODO
// Make a full list of parameters, including thresholds:
// TTI capcity as a fraction of incidence and as a global parameter
// likewise for the background rate
// Hospital cpacity likewise
// Have a death/serious case rate for the first N infectious and a second one above that.
// Scaled with the vaccination rate?
// (we are vaccinating at risk people first, so this should be non-linear in the vaccination rate) 
// General function for two rates with threshold interpolation?

// functions to go back and forth between model parameters and observed quantities??


function event(state, ch){
    // idea: Save events as {pars : "dyn_pars", field: "mu", value: "0.3"} and call event(state, {pars : "measures", field: "mu", value: "0.3"})
    state[ch.pars][ch.field] = ch.value
}

class MeasParameters {
    constructor() {
        // The parameters of the disease and the vaccination campaign

        this.mu = { value: 0.3, def: 0.3, desc: "Base R0: Number of people an infected infects on average." }
        this.mu_m = { value: 0.4, def: 0.4, desc: "Base R0 for Mutant: Number of people someone infected by the mutant infects on average." }
        this.I_to_R = { value: 0.1,  def: 0.1,  desc: "Daily rate of end of infection (recovery or death)." }
        this.E_to_I = { value: 0.5,  def: 0.5,  desc: "Daily rate of infection breaking out among those carrying the virus." }
        this.k = { value: 0.8,  def: 0.8,  desc: "Overdispersion: Not everyone infects exactly R0 people, this parameter controls how much the number of infected varies from person to person." }
        this.vac_rate = { value: 0.001,  def: 0.001,  desc: "Fraction of population vaccinated per day." }
        this.vac_eff = { value: 0.8,  def: 0.8,  desc: "Fraction of infections prevented by vaccination." }
        this.bck_rate = { value: 0.5,  def: 0.5,  desc: "Average number of infected coming into each region per day from outside the country." }
        this.bck_rate_m = { value: 0.5,  def: 0.5,  desc: "Average number of mutant infected coming into each region per day from outside the country." }
    }
}

class Meassures {
    constructor() {
        // The parameters of the disease and the vaccination campaign

        this.mu = { value: 0.3, def: 0.3, desc: "Base R0: Number of people an infected infects on average." }
        this.mu_m = { value: 0.4, def: 0.4, desc: "Base R0 for Mutant: Number of people someone infected by the mutant infects on average." }
        this.I_to_R = { value: 0.1,  def: 0.1,  desc: "Daily rate of end of infection (recovery or death)." }
        this.E_to_I = { value: 0.5,  def: 0.5,  desc: "Daily rate of infection breaking out among those carrying the virus." }
        this.k = { value: 0.8,  def: 0.8,  desc: "Overdispersion: Not everyone infects exactly R0 people, this parameter controls how much the number of infected varies from person to person." }
        this.vac_rate = { value: 0.001,  def: 0.001,  desc: "Fraction of population vaccinated per day." }
        this.vac_eff = { value: 0.8,  def: 0.8,  desc: "Fraction of infections prevented by vaccination." }
        this.bck_rate = { value: 0.5,  def: 0.5,  desc: "Average number of infected coming into each region per day from outside the country." }
        this.bck_rate_m = { value: 0.5,  def: 0.5,  desc: "Average number of mutant infected coming into each region per day from outside the country." }
    }
}



cov_pars = { 
    R:      { value: 0.2, def: 0.2, desc: "Base r-rate" },
    Rm:     { value: 0.25, def: 0.25, desc: "Base r-rate(mutations)" },
    var:    { value: 0.8,  def: 0.8,  desc: "Variance of the infection process" },
    recov:  { value: 0.1,  def: 0.1,  desc: "recovery chance" },
    E_to_I: { value: 0.5,  def: 0.5,  desc: "exposed to infectious chance" }
};

possible_measures = {
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
        
    for (reg of Regions) {
        let now = reg.S.length - 1;

        reg.travel_I = 0
        reg.travel_Im = 0
        for (nei of reg.neighbours){
            if (nei.dist < 100 && reg != Regions[nei.index]) {
                reg.travel_I += Math.round(travel * Regions[nei.index].I[now])
                reg.travel_Im += Math.round(travel * Regions[nei.index].Im[now])
            }
        }
    }

    let r_var_mult = measure_effect(curr_measures)

    for (reg of Regions) {
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
    for (reg of Regions){
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
    for (reg of Regions) {
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
