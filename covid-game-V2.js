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

        this.background_rate = 0.01
        this.tag = tag
        this.name = name
        this.neighbours = Array() // Needs to be populated later
    }
}


function region_with_incidence(total, incidence, tag, name) {
    let I = [incidence / 100000 * total];
    let E = [I[0] * 0.7];
    let R = [0];
    let S = [total - I[0]];
    return new Region(S, E, I, [0], [0], R, total, total * 0.01, tag, name);
}



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

cov_pars = {R : 0.3, Rm : 0.4, var : 0.8, recov : 0.1, E_to_I : 0.5}

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

    delta_I = binom(E, cov_pars.E_to_I)

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

    delta_R = binom(I, cov_pars.recov)

    return [delta_E, delta_I, delta_R]
}

function local_step(reg, r_mult, var_mult, tti) {

    let now = reg.S.length - 1

    let s_adjust = reg.S[now] / reg.total

    if (reg.S[now] < 0) {console.log("Something went wrong, S went negative")}

    let local_r  = s_adjust * r_mult * cov_pars.R
    let local_rm = s_adjust * r_mult * cov_pars.Rm

    if (tti) {
        local_r  *= tti_eff(reg.I[now] + reg.Im[now], reg.trace_capacity)
        local_rm *= tti_eff(reg.I[now] + reg.Im[now], reg.trace_capacity)
    }

    let local_var = var_mult * cov_pars.var

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


function step_epidemic(Regions, curr_measures, travel) {

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

    // reg = Regions[2]
    // now = reg.S.length - 1
    // console.log(r_var_mult)
    // console.log(tti_eff(reg.I[now] + reg.Im[now], reg.trace_capacity))

 
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

function count_infectious(Regions)  { return count(infectious, Regions); }
function count_exposed(Regions)     { return count(exposed, Regions); }
function count_recovered(Regions)   { return count(recovered, Regions); }


function count_susceptible(Regions){
    c = 0
    for (reg of Regions) {c += reg.S[reg.S.length - 1]}
    return c
}

function tti_over_capacity(Regions){
    let tti = 0
    for (reg of Regions) {
        if (reg.I[reg.I.length - 1] + reg.Im[reg.Im.length - 1] > reg.trace_capacity) {tti += 1}
    }
    return tti
}


function init_random_regions() {
    Regions = []

    for (let n = 0; n < 420; n++) {
        Regions.push(region_100k_u0_9_infected())
    }

    connect_regions_randomly(Regions, 2000)

    return Regions
}

function log_reg(Regions){
    console.log([tti_over_capacity(Regions), count_susceptible(Regions), count_exposed(Regions), count_infectious(Regions), count_recovered(Regions)])
}

function self_test() {

    Regions = init_random_regions()

    c_meas = new Measure_State()

    for (let n = 0; n < 5; n++) {
        log_reg(Regions)

        step_epidemic(Regions, c_meas, 0.01)
    }

    console.log("Starting test and trace program")
    c_meas.test_trace_isolate = true

    for (let n = 0; n < 5; n++) {
        log_reg(Regions)

        step_epidemic(Regions, c_meas, 0.01)
    }
    console.log("Switching on all counter measures")

    c_meas.gatherings_1000 = true
    c_meas.gatherings_100 = true
    c_meas.gatherings_10 = true
    c_meas.schools_unis_closed = true
    c_meas.some_business_closed = true
    c_meas.all_business_closed = true
    c_meas.test_trace_isolate = true
    c_meas.stay_at_home = true

    for (let n = 0; n < 25; n++) {
        log_reg(Regions)

        step_epidemic(Regions, c_meas, 0.01)
    }
    log_reg(Regions)

}

//self_test();
