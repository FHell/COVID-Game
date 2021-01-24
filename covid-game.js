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
    constructor(N_S, N_I, N_R, N_total, tag) {
        console.assert(N_S + N_I, + N_R == N_total);
        this.S = N_S
        this.I = N_I
        this.R = N_R
        this.total = N_total
        this.tag = tag
        this.neighbours = Array() // Needs to be populated later
    }
}

class Measures {
    constructor(distanced=false, schools_closed=false, business_closed=false,
                groups_limited=false, test_and_trace=false, local_measures){
        this.distanced = distanced
        this.schools_closed = schools_closed
        this.business_closed = business_closed
        this.groups_limited = groups_limited
        this.test_and_trace = test_and_trace
        this.local_measures = local_measures // array that has information on regions with local measures
    }
}

function region_100k_u0_9_infected() {
    total = 100000
    I = Math.round(10 * Math.random())
    R = 0
    S = total - I   
    return new Region(S, I, R, total, "name")
}

function region_u0_9_infected(total, tag) {
    I = Math.round(10 * Math.random())
    R = 0
    S = total - I   
    return new Region(S, I, R, total, tag)
}

function region_with_incidence(total, incidence, tag) {
    I = incidence / 100000 * total
    R = 0
    S = total - I   
    return new Region(S, I, R, total, tag)
}

function connect_regions_randomly(Regions, n_edges) {
    let n_reg = Regions.length
    for (let n = 0; n < n_edges; n++) {
        n_1 = Math.floor(Math.random() * n_reg)
        n_2 = Math.floor(Math.random() * n_reg)
        if (n_1 != n_2) {
            Regions[n_1].neighbours.push(Regions[n_2])
            Regions[n_2].neighbours.push(Regions[n_1]) 
        }
    }
}

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

    // check that S, I and R stay positive
    reg.S -= delta_I
    reg.I += delta_I - delta_R
    reg.R += delta_R
}

function step_epidemic(Regions, infect, recov, travel, curr_measures) {
    let adjusted;
    // Looking at measures
    if (curr_measures != null){
        adjusted = apply_measures(curr_measures, recov)
        infect = adjusted[0]
        recov = adjusted[1]
    }

    // We first run the epidemic locally, then we travel
    for (reg of Regions) {local_SIR_step(reg, infect, recov)}

    for (reg of Regions) {
        // For every nighbour we have probability for a random person to travel there
        for (nei of reg.neighbours) {
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

Regions = []

for (let n = 0; n < 120; n++) {
    Regions.push(region_100k_u0_9_infected())
}

connect_regions_randomly(Regions, 2000)

c_measures = Array()
c_measures.push(new Measures(true, false,false,false,
    false, false))
c_measures.push(new Measures(false, true,false,false,
    false, false))
c_measures.push(new Measures(false, false,true,false,
    false, false))
c_measures.push(new Measures(false, false,false,true,
    false, false))
c_measures.push(new Measures(false, false,false,false,
    true, false))


let count = 0
let measure_now;
let measure_old;
for (let n = 0; n < 30; n++) {
    measure_old = c_measures[count]
    if (n % 7==0) {
        measure_now = c_measures[count];
        count++;
        console.log(measure_now)
    }
    if (measure_old == measure_now) {
        step_epidemic(Regions, 0.3, 0.1, 0.9, null)
    } else {
        step_epidemic(Regions, 0.3, 0.1, 0.9, measure_now)
    }

}