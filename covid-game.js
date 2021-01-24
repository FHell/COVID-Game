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

class Region {
    constructor(N_S, N_I, N_R, N_total, tag, name) {
        console.assert(N_S + N_I, + N_R == N_total);
        this.S = N_S
        this.I = N_I
        this.R = N_R
        this.total = N_total
        this.ttin = 0 // total traveling infected neighbours
        this.tag = tag
        this.name = name
        this.neighbours = Array() // Needs to be populated later
    }
}

class Measures {
    constructor(distanced=false, schools_closed=false, business_closed=false,
                groups_limited=false, test_and_trace=false, lockdown_50=false, local_measures){
        this.distanced = distanced
        this.schools_closed = schools_closed
        this.business_closed = business_closed
        this.groups_limited = groups_limited
        this.test_and_trace = test_and_trace
        this.lockdown_50 = lockdown_50
        this.local_measures = local_measures // array that has information on regions with local measures
    }
}

function region_100k_u0_9_infected() {
    total = 100000
    I = Math.round(10 * Math.random())
    R = 0
    S = total - I   
    return new Region(S, I, R, total, "00000", "name")
}

function region_u0_9_infected(total, tag, name) {
    I = Math.round(10 * Math.random())
    R = 0
    S = total - I   
    return new Region(S, I, R, total, tag, name)
}

function region_with_incidence(total, incidence, tag, name) {
    I = incidence / 100000 * total
    R = 0
    S = total - I   
    return new Region(S, I, R, total, tag, name)
}

function connect_regions_randomly(Regions) {
    let n_reg = Regions.length
    for (reg of Regions){
        for (let n = 0; n < n_reg; n++)
            reg.neighbours.push({dist: Math.random() * 500, index: n})
    }
}

// The array neighbours contains references to the objects in the regions array:
//
// r = [region_u0_9_infected(100), region_u0_9_infected(101)]
// r[0].neighbours.push(r[1])
// r[1].neighbours.push(r[0]) 
// r[0].neighbours[0].R = 30
// console.log(r[1].R) // == 30


function local_SIR_step(reg, infect, recov) {
    let delta_I = 0 // newly infected
    let delta_R = 0 // newly recovered

    // every infected, and everyone traveling to the region
    // has chance infect to infect a random person if that person is susceptible
    for (let n = 0; n < reg.I + reg.ttin ; n++) {
        if (Math.random() < infect * reg.S / reg.total) {delta_I++}
    }

    // every infected has chance recov to recover
    for (let n = 0; n < reg.I; n++) {
        if (Math.random() < recov) {delta_R++}
    }

    // check that S, I and R stay positive
    reg.S -= delta_I
    reg.I += delta_I - delta_R
    reg.R += delta_R
}

function calc_local_params(reg, curr_measure, recov = 1/10, r = 3.0){

    // We really want more complicated logic here,
    // including local breakdowns of test and tract, but to start with this will have to do.
    if (curr_measure.distanced) {r -= 0.6}
    if (curr_measure.schools_closed) {r -= 0.6}
    if (curr_measure.business_closed) {r -= 0.5}
    if (curr_measure.groups_limited) {r -= 0.5}
    if (curr_measure.test_and_trace) {r -= 0.4}
    if (curr_measure.lockdown_50 && reg.I > 0.00005 * reg.total) {r -= 0.4}

    var infect = r * recov

    return [infect, recov]
}


function step_epidemic(Regions, travel, curr_measures) {

    // travel is the fraction of people from a region that travel to a neighbouring region
    // in our first approximation these are simply all regions within 100km and travel is a constant fraction.
    // these people cause infections at the place they travel to as well as at home.
    for (reg of Regions) {
        reg.ttin = 0
        for (nei of reg.neighbours){
            if (nei.dist < 100 && reg != Regions[nei.index]) {reg.ttin += Math.round(travel * Regions[nei.index].I)}
        }
    }

    for (reg of Regions) {
        let pars = calc_local_params(reg, curr_measures);
        local_SIR_step(reg, pars[0], pars[1])
    }

}

function apply_measures(curr_measure, recov = 1/10, r = 3.0){

    // We really want more complicated logic here,
    // including local breakdowns of test and tract, but to start with this will have to do.
    if (curr_measure.distanced) {r -= 0.6}
    if (curr_measure.schools_closed) {r -= 0.6}
    if (curr_measure.business_closed) {r -= 0.5}
    if (curr_measure.groups_limited) {r -= 0.5}
    if (curr_measure.test_and_trace) {r -= 0.4}

    var infect = r * recov

    return [infect, recov]
}

function count_infected(Regions){
    infected = 0
    for (reg of Regions) {infected += reg.I}
    return infected
}

function self_test() {
    Regions = []

    for (let n = 0; n < 120; n++) {
        Regions.push(region_100k_u0_9_infected())
    }

    connect_regions_randomly(Regions, 2000)

    c_measures = Array()
    c_measures.push(new Measures(true, false,false,false,
        false, false, false))
    c_measures.push(new Measures(false, true,false,false,
        false, false, false))
    c_measures.push(new Measures(false, false,true,false,
        false, false, false))
    c_measures.push(new Measures(false, false,false,true,
        false, false, false))
    c_measures.push(new Measures(false, false,false,false,
        true, false, false))


    let count = 0
    let measure_now = c_measures[0]
    for (let n = 0; n < 30; n++) {
        if (n % 7==0) {
            measure_now = c_measures[count];
            count++;
            console.log(measure_now)
        }
        step_epidemic(Regions, 0.01, measure_now)
        console.log(count_infected(Regions))
    }
}

self_test();
