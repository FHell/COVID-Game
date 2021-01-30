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
    suc = 0
    for (let n = 0; n < N; n++) {
        if (Math.random() < p) {suc++}
    }
    return suc
}

function neg_binom(r, p){
    suc = 0
    fai = 0
    while (fai < r) {
        if (Math.random() < p) {suc++} else {fai++}
    }
    return suc
}

class Region {
    constructor(N_S, N_E, N_I, N_Em, N_Im, N_R, N_total, trace_capacity, tag, name) {
        console.assert(N_S + N_I, + N_R == N_total);
        
        // These should be arrays        
        this.S = N_S
        this.E = N_E
        this.I = N_I
        this.Em = N_Em
        this.Im = N_Im
        this.R = N_R

        this.total = N_total
        this.trace_capcity = trace_capacity

        this.travel_I = 0 // total traveling infected neighbours
        this.travel_Im = 0 // total traveling infected neighbours with mutant

        this.background_rate = 0.1
        this.tag = tag
        this.name = name
        this.neighbours = Array() // Needs to be populated later
    }
}

// Measures taken from slide
class Measure_State {
    constructor(){
        this.gatherings_1000 = false
        this.gatherings_100 = false
        this.gatherings_10 = false
        this.schools_unis_closed = false
        this.some_business_closed = false
        this.all_business_closed = false
        this.test_trace_isolate = false
        this.stay_at_home = false
    }
}

// translate the current measures into a relative scaling of R and var
// To start with we assume they are proportional
function measure_effect(cm) {
    // This is how I interpret the slide. Might or might not be true:
    r_mult = 1.
    if (cm.gatherings_10) {r_mult *= 1 - 0.2}
    else if (cm.gatherings_100) {r_mult *= 1 - 0.25}
    else if (cm.gatherings_1000) {r_mult *= 1 - 0.35}

    if (cm.schools_unis_closed) {r_mult *= 1 - 0.4}
    
    if (cm.some_business_closed) {r_mult *= 1 - 0.2}
    else if (cm.all_business_closed) {r_mult *= 1 - 0.3}

    if (cm.stay_at_home) {r_mult *= 1 - 0.1}

    return [r_mult, r_mult]
}

cov_pars = {R : 0.3, Rm : 0.45, var : 0.8, recov : 0.1, E_to_I : 0.5}

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
    i = Math.floor(x)
    if (Math.random() < (x - i)) {return i + 1} else {return i}
}

function local_step(reg, r_mult, var_mult, tti) {
    // Unfortunately it seems that these sample functions are not very efficient once the
    // epidemic goes large. We should replace them with approximations then.
    // Both binomial and negative binomial become approximately normal for large size
    // parameter.

    delta_E = 0 // newly exposed
    delta_Em = 0 // newly exposed mutant
    delta_I = 0 // newly infected
    delta_Im = 0 // newly infected mutant
    delta_R = 0 // newly removed
    delta_Rm = 0 // newly removed mutant

    now = reg.S.length - 1

    if (reg.S[now] < 0) {console.log("Something went wrong, S went negative")}

    if (tti) {
        local_r = (reg.S[now] / reg.total) * r_mult * cov_pars.R * tti_eff(reg.I[now] + reg.Im[now], reg.trace_capacity)
        local_rm = (reg.S[now] / reg.total) * r_mult * cov_pars.Rm * tti_eff(reg.I[now] + reg.Im[now], reg.trace_capacity)
    }
    else {
        local_r = (reg.S[now] / reg.total) * r_mult * cov_pars.R
        local_rm = (reg.S[now] / reg.total) * r_mult * cov_pars.Rm
    }
    local_var = (reg.S[now] / reg.total) * var_mult * cov_pars.var

    // Every exposed has an E_to_I probability to become infectious
    delta_I = binom(reg.E[now], cov_pars.E_to_I)
    delta_Im = binom(reg.Em[now], cov_pars.E_to_I)

    // Every infectious in the region will cause a negative binomial distribution of new infected today.
    // The sum of N iid negative binomials is a negative binomial with size parameter scaled by N
    
    // The variance must always be larger than the mean in this model.
    //  The threshold 1.1 is arbitrary here, hopefully we wont hit this case with real parametrization.
    if (local_var < 1.1 * local_r) {local_var = 1.1 * local_r}

    // Calculate the negative binomial parameters
    p = 1 - local_r/local_var
    size = prob_round((reg.I[now] + reg.travel_I) * (1 - p) / p + reg.background_rate)
    delta_E = neg_binom(size, p)

    if (local_var < 1.1 * local_rm) {local_var = 1.1 * local_rm}

    pm = 1 - local_rm/local_var
    sizem = prob_round((reg.Im[now] + reg.travel_Im) * (1 - pm) / pm  + reg.background_rate)
    delta_Em = neg_binom(sizem, pm)

    // Every recovered has a recov probability to recover
    delta_R = binom(reg.I[now], cov_pars.recov)
    delta_Rm = binom(reg.Im[now], cov_pars.recov)


    c1 = reg.S[now] - delta_E - delta_Em
    if (c1 < 0){
        if (-c1 < delta_E) {delta_E += c1}
        else if (-c1 < delta_Em) {delta_Em += c1}
        else if (-c1 < delta_Em + delta_E) {delta_Em += c1 + delta_E; delta_E = 0}
        else {delta_Em = reg.S[now]; delta_E = 0}
        }

    reg.S.push(reg.S[now] - delta_E - delta_Em)
    reg.E.push(reg.E[now] + delta_E - delta_I)
    reg.Em.push(reg.Em[now] + delta_Em - delta_Im)
    reg.I.push(reg.I[now] + delta_I - delta_R)
    reg.Im.push(reg.Im[now] + delta_Im - delta_Rm)
    reg.R.push(reg.I[now] + delta_R - delta_Rm)
}

function step_epidemic(Regions, curr_measures, travel) {

    // travel is the fraction of people from a region that travel to a neighbouring region
    // in our first approximation these are simply all regions within 100km and travel is a constant fraction.
    // these people cause infections at the place they travel to as well as at home.
    
    now = reg.S.length - 1
    
    for (reg of Regions) {
        reg.travel_I = 0
        reg.travel_Im = 0
        for (nei of reg.neighbours){
            if (nei.dist < 100 && reg != Regions[nei.index]) {
                reg.travel_I += Math.round(travel * Regions[nei.index].I[now])
                reg.travel_Im += Math.round(travel * Regions[nei.index].Im[now])
            }
        }
    }

    r_var_mult = measure_effect(curr_measures)

    for (reg of Regions) {
        local_step(reg, r_var_mult[0], r_var_mult[1], curr_measures.test_trace_isolate)
    }

}

function region_100k_u0_9_infected() {
    total = 100000
    trace_capacity = 1000
    I = [Math.round(10 * Math.random())]
    Im = [0]
    E = [0]
    Em = [0]
    R = [0]
    S = [total - I[0]]
    return new Region(S, E, I, Em, Im, R, total, trace_capacity, "000", "LK")
}

function connect_regions_randomly(Regions) {
    let n_reg = Regions.length
    for (reg of Regions){
        for (let n = 0; n < n_reg; n++)
            reg.neighbours.push({dist: Math.random() * 500, index: n})
    }
}

function count_infectious(Regions){
    infectious = 0
    for (reg of Regions) {infectious += reg.I[reg.I.length - 1] + reg.Im[reg.Im.length - 1]}
    return infectious
}

function count_exposed(Regions){
    exposed = 0
    for (reg of Regions) {exposed += reg.E[reg.E.length - 1] + reg.Em[reg.Em.length - 1]}
    return exposed
}

function count_recovered(Regions){
    recovered = 0
    for (reg of Regions) {recovered += reg.R[reg.R.length - 1]}
    return recovered
}

function tti_over_capacity(Regions){
    tti = 0
    for (reg of Regions) {if (reg.I[reg.I.length - 1] + reg.Im[reg.Im.length - 1] > reg.trace_capacity) tti += 1}
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

function self_test() {

    Regions = init_random_regions()

    c_meas = new Measure_State()

    for (let n = 0; n < 30; n++) {
        step_epidemic(Regions, c_meas, 0.01)
        console.log(count_infectious(Regions))
    }
}

self_test();
