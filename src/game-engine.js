// Core data structures

// We have the state of the Country and of the individual regions first.
// These contain the timelines for various quantities, as well as some
// basic information attached to either.

export class Country {
    constructor() {

        // Here we can also save summary information that we want to show
        // like highscore data, number of people who died, number of
        // person-days in lockdown, etc...

        this.S = [0]
        this.E = [0]
        this.I = [0]
        this.Em = [0]
        this.Im = [0]
        this.R = [0]

        this.ratio_vac = 0

        this.deaths = [0]
        this.cumulative_infections = [0] // Plot this
        this.cumulative_infections_mutation_only = [0] // Plot this
        this.cumulative_infections_original_only = [0] // Plot this
        this.cumulative_deaths = [0] // Plot this
        this.seven_d_incidence = [0] // Plot this
        this.global_tti = 0. // Give a gauge showing this.
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

        this.seven_d_incidence = [0] // Map this
        this.seven_d_incidence_velocity = [0] // Map this
        this.local_tti = 0. // Map this
        this.cumulative_deaths = [0] // Map this
    }
}

// An important way to initialize a region is given an incidence and a total number of people

export function region_with_incidence(total, incidence, tag, name) {
    let I = [incidence / 100000 * total];
    let E = [I[0] * 0.7];
    let R = [0];
    let S = [total - I[0]];
    return new Region(S, E, I, [0], [0], R, total, tag, name);
}


function region_100k_u0_9_infected() {
    let total = 100000
    let I = [Math.round(10 * Math.random())]
    let Im = [0]
    let E = [0]
    let Em = [0]
    let R = [0]
    let S = [total - I[0]]
    return new Region(S, E, I, Em, Im, R, total, "000", "LK")
}

function connect_regions_randomly(Regions) {
    let n_reg = Regions.length
    for (let reg of Regions) {
        for (let n = 0; n < n_reg; n++)
            reg.neighbours.push({ dist: Math.random() * 500, index: n })
    }
}


// We then have the parameters for the disease and death model, as well as some properties derived from the parameters.

export class DynParameters {
    constructor() {
        // The parameters of the disease and the vaccination campaign

        // Disease dynamics
        this.mu = { value: 3, def: 3, desc: "Base R0: Number of people an infected infects on average." }
        this.mu_m = { value: 4, def: 4, desc: "Base R0 for Mutant: Number of people someone infected by the mutant infects on average." }
        this.I_to_R = { value: 0.2, def: 0.2, desc: "Daily rate of end of infectiousness (leading to recovery or death)." }
        this.E_to_I = { value: 0.4, def: 0.4, desc: "Daily rate of infection breaking out among those carrying the virus (they become infectious for others)." }
        this.k = { value: 0.1, def: 0.1, desc: "Overdispersion: Not everyone infects exactly R0 people, this parameter controls how much the number of infected varies from person to person." }
        this.vac_rate = { value: 0.001, def: 0.001, desc: "Fraction of population vaccinated per day." }
        this.vac_eff = { value: 0.8, def: 0.8, desc: "Fraction of infections prevented by vaccination." }
        this.tti_capacity = { value: 0.0001, def: 0.0001, desc: "Trace capacity as fraction of total local population." }
        this.bck_rate = { value: 0.5, def: 0.5, desc: "Average number of infected coming into each region per day from outside the country." }
        this.bck_rate_m = { value: 0.5, def: 0.5, desc: "Average number of mutant infected coming into each region per day from outside the country." }

        // Death model
        this.hospital_capacity = { value: 0.001, def: 0.001, desc: "ICU capacity as a fraction of population." }
        this.death_rate_1 = { value: 0.01, def: 0.01, desc: "Fraction of deaths for people within hospital capactity." }
        this.death_rate_2 = { value: 0.05, def: 0.05, desc: "Fraction of deaths for people beyond hospital capactity." }
        this.vulnerable = { value: 0.2, def: 0.2, desc: "Fraction of vulnerable in the population." }
        this.non_vul_dr = { value: 0.1, def: 0.1, desc: "Rate of serious complications/deaths among non-vulnerable population relative to overall population (this modifier gradually kicks in as the vulnerable get vaccinated)." }
    }
}

function deaths(dyn_pars, I, v_rate, delta_R, N_total) {
    // death model
    // We assume vaccination prevents hospitalization
    // Then take the ratio of hospital capacity to the number of unvaccinated infected.
    let hos = N_total * dyn_pars.hospital_capacity.value / ((1 - v_rate) * I)
    let base_dr
    let dr
    if (hos > 1) {
        base_dr = dyn_pars.death_rate_1.value
    } else {
        base_dr = hos * dyn_pars.death_rate_1.value + (1 - hos) * dyn_pars.death_rate_2.value
    }

    // We assume that once the vulnerable are infected mortality will be much lower
    if (v_rate > dyn_pars.vulnerable.value) { dr = base_dr * dyn_pars.non_vul_dr.value }
    else { dr = ((1 - v_rate) + v_rate * dyn_pars.non_vul_dr.value) * base_dr }

    return prob_round(dr * delta_R)
}

class DerivedProps {
    constructor(dyn_pars) {
        this.time_to_infectious = { value: 1 + (1 - dyn_pars.E_to_I.value) / dyn_pars.E_to_I.value, desc: "Average time until an infected person becomes infectious." }
        this.time_of_infectiousness = { value: 1 + (1 - dyn_pars.I_to_R.value) / dyn_pars.I_to_R.value, desc: "Average time a person is infectious." }
        // this.superspreader_20 = {value: ..., desc: "20% of people infect this fraction of the total amount of infected."}
    }
}


// The core dynamic of the SEIR model is given next in terms of binomial and negative binomial distributions
// Our negative binomial diefinition follows that of Wikipedia.

function normal(mean, variance) {
    // Box-Muller Transform
    let u1 = Math.random()
    let u2 = Math.random()
    let z = Math.sqrt(-2. * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    let n = mean + z * Math.sqrt(variance)
    if (n < 0.) { n = 0. }
    return Math.round(n)
}

function binom(N, p) {

    // Performance optimisation
    let mean = N * p
    let anti_mean = N * (1 - p)

    if (mean > 10 && anti_mean > 10) {
        return normal(mean, mean * (1 - p))
    }

    // actual simulation
    let suc = 0
    for (let n = 0; n < N; n++) {
        if (Math.random() < p) { suc++ }
    }
    return suc
}

function neg_binom(r, p) {
    if (p == 0.) { console.log("Negative binomial was called with p = 0"); return 0 } // Convenient failure mode
    if (p == 1.) { console.log("Negative binomial was called with p = 1"); return Infinity } // Convenient failure mode

    // Performance optimisation. This might not be fully justified for very small
    // p which can happen when many people are infected but few are susceptible.
    
    if (r > 500) {
        let mean = r * p / (1 - p)
        let variance = mean / (1 - p)
        return normal(mean, variance)
    }

    // actual simulation
    let suc = 0;
    let fai = 0;
    while (fai < r) {
        if (Math.random() < p) { suc++ } else { fai++ }
    }
    // if (fai + suc > 10000) {console.log(`Expensive NegBin, mean: ${mean}, p: ${p}; r: ${r}`)}
    return suc
}

function prob_round(x) {
    // This function rounds to the integer i below x with probability 1 - (x - i),
    // and to the integer above otherwise. In terms of linear expectation values
    // this is a smooth rounding function. :)
    let i = Math.floor(x)
    if (Math.random() < (x - i)) { return i + 1 } else { return i }
}

function get_deltas(E, I, I_travel, E_to_I, I_to_R, mu, k, v, background) {

    let delta_E = 0 // newly exposed
    let delta_I = 0 // newly infected
    let delta_R = 0 // newly removed

    delta_I = binom(E, E_to_I)
    delta_R = binom(I, I_to_R)

    // we need to get the paremters r and p from the mu and k which we specify / which the measures
    // affect directly.
    let d_infect = (1 + (1 - I_to_R) / I_to_R)
    let mu_d = mu / d_infect
    let r = 1 / k
    let p = mu_d / (r + mu_d)

    let I_eff = (1 - v) * (I + I_travel) + background
    let size = prob_round(r * I_eff)
    delta_E = neg_binom(size, p)

    return [delta_E, delta_I, delta_R]
}

// We can show how the disease model looks for an individual if everyone else is susceptible:

function one_person_timeline(E_to_I, I_to_R, mu, k) {
    let d_e = 0
    let E = 1
    let I = 0
    let I_travel = 0
    let v = 0
    let background = 0
    let delta_I = 0
    while (delta_I == 0) {
        let deltas = get_deltas(E, I, I_travel, E_to_I, I_to_R, mu, k, v, background)
        d_e++
        delta_I = deltas[1]
    }

    E = 0
    I = 1

    let infect = []
    let delta_R = 0
    while (delta_R == 0) {
        let deltas = get_deltas(E, I, I_travel, E_to_I, I_to_R, mu, k, v, background)
        delta_R = deltas[2]
        infect.push(deltas[0])
    }

    return [d_e, infect]
}

function one_person_timeline_average(dyn_pars, N) {
    let timeline = [0]
    let totals = [0]
    let total = 0
    for (let n = 0; n < N; n++) {
        let opl = one_person_timeline(dyn_pars.E_to_I.value, dyn_pars.I_to_R.value, dyn_pars.mu.value, dyn_pars.k.value)
        while ((opl[1].length + opl[0]) > timeline.length) { timeline.push(0) }
        total = 0

        for (let m = 0; m < opl[1].length; m++) {
            timeline[m + opl[0]] += opl[1][m]
            total += opl[1][m]
        }

        while (total > totals.length - 1) { totals.push(0) }

        totals[total] += 1
    }

    for (let m = 0; m < timeline.length; m++) {
        timeline[m] /= N
    }

    // for (let m = 0; m < totals.length; m++) {
    //     totals[m] /= N
    // }

    return [totals, timeline]
}

// We now come to the model of the measures

export class Measures {
    constructor() {

        this.gatherings_1000 = { value: 1 - 0.2, active: false, desc: "No gatherings with more than 1000 people" }
        this.gatherings_100 = { value: 1 - 0.25, active: false, desc: "No gatherings with more than 100 people" }
        this.gatherings_10 = { value: 1 - 0.35, active: false, desc: "No gatherings with more than 10 people" }
        this.schools_unis_closed = { value: 1 - 0.4, active: false, desc: "Schools and Universities are closed" }
        this.some_business_closed = { value: 1 - 0.2, active: false, desc: "Selected (high-traffic) buisnesses are closed" }
        this.all_business_closed = { value: 1 - 0.3, active: false, desc: "All non-essential buisnesses are closed" }
        this.test_trace_isolate = { value: 1 - 0.33, active: false, desc: "Trace & isolate infected persons" }
        this.stay_at_home = { value: 1 - 0.1, active: false, desc: "Strict 'stay at home' orders" }
        this.hard_ld_inc = { value: 1 - 0.9, active: false, desc: "Complete lockdown at incidence > 20" }
    }

    toggle(key) {
        this[key].active = !this[key].active;
    }
}

function measure_effect(cm) {
    // This is how I interpret the slide. Might or might not be true:
    let mu_mult = 1.
    Object.keys(cm).filter(m => cm[m].active && m != "test_trace_isolate" && m != "hard_ld_inc").map(m => { mu_mult *= cm[m].value })
    return mu_mult
}

function tti_eff(infected, trace_capacity, cm) {
    // rough model is Just dreamed up of test, trace, isolate efficiency,
    // if we can trace everyone we reduce R by 1/3rd
    // if not we reduce it by 1/3rd for the fraction traced and not at all for the rest.
    if (infected < trace_capacity) { return cm.test_trace_isolate.value }
    else { return (cm.test_trace_isolate.value * trace_capacity / infected + (infected - trace_capacity) / infected) }
}


// Now putting things together for a local SEIR step

function local_step(reg, country, dyn_pars, cm, mu_mult) {

    let now = reg.S.length - 1

    let s_adjust = reg.S[now] / reg.total

    if (reg.S[now] < 0) { console.log("Something went wrong, S went negative") }

    let local_mu = s_adjust * mu_mult * dyn_pars.mu.value
    let local_mu_m = s_adjust * mu_mult * dyn_pars.mu_m.value

    if (cm.hard_ld_inc.active && reg.seven_d_incidence[now] > 20) {
        local_mu = s_adjust * cm.hard_ld_inc.value * dyn_pars.mu.value
        local_mu_m = s_adjust * cm.hard_ld_inc.value * dyn_pars.mu_m.value
    }

    if (cm.test_trace_isolate.active) {
        const te = tti_eff(reg.I[now] + reg.Im[now], dyn_pars.tti_capacity.value * reg.total, cm)
        local_mu *= te
        local_mu_m *= te
        reg.local_tti = te
    }

    let v_eff = country.ratio_vac * dyn_pars.vac_eff.value

    let deltas = get_deltas(reg.E[now], reg.I[now], reg.travel_I, dyn_pars.E_to_I.value, dyn_pars.I_to_R.value, local_mu, dyn_pars.k.value, v_eff, dyn_pars.bck_rate.value)

    let delta_E = deltas[0] // newly exposed
    let delta_I = deltas[1] // newly infectious
    let delta_R = deltas[2] // newly removed

    let deltas_m = get_deltas(reg.Em[now], reg.Im[now], reg.travel_Im, dyn_pars.E_to_I.value, dyn_pars.I_to_R.value, local_mu_m, dyn_pars.k.value, v_eff, dyn_pars.bck_rate_m.value)

    let delta_Em = deltas_m[0] // newly exposed mutant
    let delta_Im = deltas_m[1] // newly infectious mutant
    let delta_Rm = deltas_m[2] // newly removed mutant

    // Handle the case when the last susceptible in a region become exposed:
    let c1 = reg.S[now] - delta_E - delta_Em

    if (c1 > 0) {
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

    let d = deaths(dyn_pars, reg.I[now] + reg.Im[now], country.ratio_vac, delta_R + delta_Rm, reg.total)

    reg.seven_d_incidence.push(avg7_incidence(reg))

    if (now > 0) {
        reg.seven_d_incidence_velocity.push(reg.seven_d_incidence[now + 1] - reg.seven_d_incidence[now])
        reg.cumulative_deaths.push(reg.cumulative_deaths[now]) + d
    }
    else {
        reg.seven_d_incidence_velocity.push(0)
        reg.cumulative_deaths.push(d)
    }

    return [d, delta_E, delta_Em]
}


export function step_epidemic(country, regions, cm, dyn_pars, travel) {

    country.ratio_vac += dyn_pars.vac_rate.value // Vaccinate some people...
    if (country.ratio_vac > 1.) {country.ratio_vac = 1.} // ... but not more than all people.

    // console.log(country.ratio_vac)

    // travel is the fraction of people from a region that travel to a neighbouring region
    // in our first approximation these are simply all regions within 100km and travel is a constant fraction.
    // these people cause infections at the place they travel to as well as at home.

    let now = regions[0].S.length - 1;

    for (let reg of regions) {

        reg.travel_I = 0
        reg.travel_Im = 0
        for (let nei of reg.neighbours) {
            if (nei.dist < 100 && reg != regions[nei.index]) {
                reg.travel_I += Math.round(travel * regions[nei.index].I[now])
                reg.travel_Im += Math.round(travel * regions[nei.index].Im[now])
            }
        }
    }

    let mu_mult = measure_effect(cm)
    let d = 0
    let delta_E = 0
    let delta_Em = 0


    for (let reg of regions) {
        let ls = local_step(reg, country, dyn_pars, cm, mu_mult)
        d += ls[0]
        delta_E += ls[1]
        delta_Em += ls[2]
    }

    // Push to the data arrays.

    country.S.push(count(S_now, regions))
    country.E.push(count(E_now, regions))
    country.I.push(count(I_now, regions))
    country.Em.push(count(Em_now, regions))
    country.Im.push(count(Im_now, regions))
    country.R.push(count(R_now, regions))
    country.deaths.push(d)

    country.cumulative_infections.push(country.cumulative_infections[now] + delta_E + delta_Em)
    country.cumulative_infections_mutation_only.push(country.cumulative_infections_mutation_only[now] + delta_Em)
    country.cumulative_infections_original_only.push(country.cumulative_infections_original_only[now] + delta_E)
    country.cumulative_deaths.push(country.cumulative_deaths[now] + d)
    country.seven_d_incidence.push(avg7_incidence(country))
    country.global_tti = tti_global_effectiveness(regions, dyn_pars, cm)
    // debug output
    // let re = regions[2]

    // let now = re.S.length - 1

    // let s_adjust = re.S[now] / re.total

    // let local_r  = s_adjust * mu_mult * dyn_pars.mu.value
    // console.log(tti_eff(re.I[now] + re.Im[now], dyn_pars.tti_capacity.value * reg.total, cm), mu_mult, local_r)
    // console.log(cm.gatherings_1000.active)

}

function get_current(field) { return field[field.length - 1]; }
function count(proj, r) { return r.reduce((a, v) => a + proj(v), 0); }

function exposed(reg) { return get_current(reg.E) + get_current(reg.Em); }
function infectious(reg) { return get_current(reg.I) + get_current(reg.Im); }
function infected(reg) { return exposed(reg) + infectious(reg); }
function recovered(reg) { return get_current(reg.R); }
function susceptible(reg) { return get_current(reg.S); }
function total(reg) { return reg.total; }

function count_infectious(Regions) { return count(infectious, Regions); }
function count_exposed(Regions) { return count(exposed, Regions); }
function count_recovered(Regions) { return count(recovered, Regions); }
function count_susceptible(Regions) { return count(susceptible, Regions); }

function S_now(reg) { return get_current(reg.S); }
function E_now(reg) { return get_current(reg.E); }
function I_now(reg) { return get_current(reg.I); }
function Em_now(reg) { return get_current(reg.Em); }
function Im_now(reg) { return get_current(reg.Im); }
function R_now(reg) { return get_current(reg.R); }



//
function average(arr) { return arr.reduce((a, v) => a + v, 0) / arr.length; }

// TODO: fix the projections above so that we can use them here
export function avg7_incidence(reg) {
    let c = 0, s = 0;
    for (let i = reg.I.length - 3; i >= 0; i--) {
        c++;
        s += ((reg.I[i] + reg.Im[i] + reg.E[i] + reg.Em[i]) / reg.total) * 100000;

        if (c > 7) { break; }
    }
    return (s / c) || 0;
}

//tti = Test Trace Isolate

function tti_over_capacity(Regions, dyn_pars) {
    let tti = 0
    for (let reg of Regions) {
        if (reg.I[reg.I.length - 1] + reg.Im[reg.Im.length - 1] > dyn_pars.tti_capacity.value * reg.total) { tti += 1 }
    }
    return tti
}

function tti_global_effectiveness(Regions, dyn_pars, cm) {
    let tti_prevented = 0
    let n = Regions.length
    for (let reg of Regions) {
        let tti = tti_eff(infected(reg), dyn_pars.tti_capacity.value * reg.total, cm)
        let tti_max = tti_eff(0, dyn_pars.tti_capacity.value * reg.total, cm)
        tti_prevented += (1 - tti) / (1 - tti_max)
    }
    return tti_prevented / n
}

// First naive implementation, use projections once they can look into the past?
function get_timelines(Country) {
    // ToDo: check that length Regions > 0
    let S = Country.S
    let E = Country.E
    let I = Country.I
    let Im = Country.Im
    let Em = Country.Em
    let R = Country.R
    return { S: S, E: E, I: I, Im: Im, Em: Em, R: R }
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

function log_reg(Regions, dyn_pars, cm) {
    console.log([tti_global_effectiveness(Regions, dyn_pars, cm), count_susceptible(Regions), count_exposed(Regions), count_infectious(Regions), count_recovered(Regions)])
}
function log_country(c) {
    console.log(c.global_tti, [c.seven_d_incidence, c.cumulative_deaths, c.S, c.E, c.Em, c.I, c.Im].map(get_current))
}

function self_test() {

    let Regions = init_random_regions()
    let c_meas = new Measures()
    let country = new Country()
    let dyn_pars = new DynParameters()

    console.log(one_person_timeline_average(dyn_pars, 1000))

    // return

    for (let n = 0; n < 150; n++) {
        log_country(country)

        step_epidemic(country, Regions, c_meas, dyn_pars, 0.01)
    }

    console.log("Starting test and trace program")
    c_meas.test_trace_isolate.active = true

    for (let n = 0; n < 15; n++) {
        log_country(country)

        step_epidemic(country, Regions, c_meas, dyn_pars, 0.01)
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
        log_country(country)

        step_epidemic(country, Regions, c_meas, dyn_pars, 0.01)
    }
    log_country(country)
    log_country(country)
    console.log(get_timelines(country).S.length)

}

self_test();
