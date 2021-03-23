export default class MapPlot {
  constructor(element, topo, state) {
    this.topo = topo;
    this.state = state;

    const $selector = $('<select class="form-control form-control-sm map-plot-selector"></select>')
      .on('change', () => { this.setVariable($selector.val()); })
      .append(Object.entries(MapPlot.variables).map(([varId, variable]) => {
        return $('<option></option>')
          .attr('value', varId)
          .text(variable.name)
      }))
      .appendTo(element);

    const $svgElement = $('<svg class="map" viewBox="-100 -10 380 800" preserveAspectRatio="xMinYMin"></svg>')
      .appendTo(element);

    this.svg = d3.select($svgElement[0]);
    this.width = 300;
    this.height = 400;

    this.projection = d3.geoMercator()
      .scale(2200)
      .center([12, 52])
      .translate([this.width / 2, this.height / 2]);

    this.variable = MapPlot.defaultVariable;
    this.setScale(MapPlot.defaultScale);
  }

  setScale(scale) {
    this.scale = scale;
    this.colorScale = d3.scaleThreshold()
      .domain(this.scale)
      .range(d3.schemeOrRd[this.scale.length + 1]);
  }

  setVariable(variable) {
    this.variable = variable;
    if (MapPlot.variables[variable].scale) {
      this.setScale(MapPlot.variables[variable].scale);
    } else {
      this.setScale(MapPlot.defaultScale);
    }
    this.update();
  }

  draw() {
    // TODO: This recreates all geometry, we should only update the final fill state.
    this.svg.selectAll("g").remove();
    this.svg.append("g")
      .selectAll("path")
      .data(this.topo.features)
      .enter()
      .append("path")
      .attr("d", d3.geoPath().projection(this.projection));

    this.update();
  }

  update() {
    this.svg.selectAll('path')
      .attr('fill', (f) => {
        // set the color of each country
        let ctag = f.properties.AGS;
        let cr = this.state.regions.find(e => e.tag == ctag);
        if (Array.isArray(cr[this.variable])) {
          return cr[this.variable].length > 0 ?
            this.colorScale(cr[this.variable][cr[this.variable].length - 1]) : // cr[this.variable][this.state.now]
            0;
        } else {
          return this.colorScale(cr[this.variable]);
        }
      });
  }
}

MapPlot.variables = {
  seven_d_incidence: {
    name: '7-day incidence',
  },
  seven_d_incidence_velocity: {
    name: '7-day incidence velocity',
  },
  local_tti: {
    name: 'Track and trace incidence',
    scale: [0, 0.1, 0.2, 0.4, 0.6, 0.8, 0.9, 1],
  },
  cumulative_deaths: {
    name: 'Cumulative deaths',
  }
};

MapPlot.defaultVariable = 'seven_d_incidence';

MapPlot.defaultScale = [5, 25, 50, 100, 150, 200, 300, 400];

// function createElementFromHTML(html) {
//   let div = document.createElement('div');
//   div.innerHTML = html.trim();
//   return div;
// }

// export function initLegend() {
//   let cm = document.getElementById('legend');
//   var firstLegendString = '< '.concat(legendValues[0].toString());
//   cm.appendChild(createElementFromHTML(
//     `<span class="legendspan" style="background-color:${colorScale(legendValues[0] - 1)};"></span> <label >${firstLegendString}</label><br>`
//   ));
//   for (var i = 1; i < legendValues.length; i++) {
//     var legendString = ''.concat(legendValues[i - 1].toString(), ' - ', legendValues[i].toString());
//     cm.appendChild(createElementFromHTML(
//       `<span class="legendspan" style="background-color:${colorScale(legendValues[i] - 1)};"></span> <label >${legendString}</label><br>`
//     ))
//   }
//   var lastLegendString = '> '.concat(legendValues[legendValues.length - 1].toString());
//   cm.appendChild(createElementFromHTML(
//     `<span class="legendspan" style="background-color:${colorScale(legendValues[legendValues.length - 1])};"></span> <label >${lastLegendString}</label><br>`
//   ));
// }
