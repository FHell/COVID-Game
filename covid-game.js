/*
The overall design is: We have abunch of regions with exchange between them.
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
    constructor(N_S, N_I, N_R, N_total, tag){
        this.S = N_S
        this.I = N_I
        this.R = N_R
        this.total = N_total
        this.tag = tag
        this.neighbours = [] // Needs to be populated later
    }
}

var neighbours = [] //array of array of neighbours
var Regions = []

function local_SIR_step(reg, infect, recov) {
    let delta_I = 0 // newly infected
    let delta_R = 0 // newly recovered

    // every infected has chance infect to infect a random person if that person is susceptible
    for (let n = 0; n < reg.I; n++) {
        if (Math.random() < infect * reg.S / reg.total) {delta_I++}
    }

    // every infected has chance recov to recover
    for (let n = 0; n < reg.I; n++) {
        if (Math.random() < recov) {delta_R++}
    }

    reg.S -= delta_I
    reg.I += delta_I - delta_R
    reg.R -= delta_R
}

function step_epidemic(Regions, infect, recov, travel) {
    // We first run the epidemic locally, then we travel
    for (reg in Regions) {local_SIR_step(reg, infect, recov)}

    for (reg in Regions) {
        // For every nighbour we have probability for a random person to travel there
        for (nei in reg.neighbours) {
            if (Math.random() < travel) {
                r = Math.random() * reg.total
                if (reg.S < r) {reg.S--; nei.S++}
                else if (reg.S + reg.I < r) {reg.I--; nei.I++}
                else {reg.R--; nei.R++}
                reg.total--; nei.total++
            }
        }
    }
}

function measures(distanced, school_closed, business_closed, groups_limited, test_trace){
    var recov = 1/10
    var r = 3.0

    // We really want more complicated logic here,
    // including local breakdowns of test and tract, but to start with this will have to do.
    if (distanced) {r -= 0.6}
    if (school_closed) {r -= 0.6}
    if (business_closed) {r -= 0.5}
    if (groups_limited) {r -= 0.5}
    if (test_trace) {r -= 0.4}

    var infect = r * recov

    return [infect, recov]
}

