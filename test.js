
Regions = []

for (let n = 0; n < 3; n++) {
    Regions.push(random_region())
}

connect_regions_randomly(Regions, 2)

console.log(Regions)

step_epidemic(Regions, 0.9, 0.1, 0.9)

console.log(Regions)

step_epidemic(Regions, 0.9, 0.1, 0.9)

console.log(Regions)
