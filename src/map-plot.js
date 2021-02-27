import "./sass/default.scss";

import {
    avg7_incidence,
  } from './game-engine';


function createElementFromHTML(html) {
    let div = document.createElement('div');
    div.innerHTML = html.trim();
    return div;
  }


//---- Map Rendering ----------------------------------------------------------------------------------------------------------
var svg = d3.select("svg");
var svg_width = 300;
var svg_height = 400;

// Map and projection
var path = d3.geoPath();
var projection = d3.geoMercator()
  .scale(2200)
  .center([12, 52])
  .translate([svg_width / 2, svg_height / 2]);

// Data and color scale
var data = d3.map();
var legendValues = [5, 25, 50, 100, 150, 200, 300, 400];
var colorScale = d3.scaleThreshold()
  .domain(legendValues)
  .range(d3.schemeOrRd[legendValues.length + 1]);

export function initLegend() {
  let cm = document.getElementById('legend');
  var firstLegendString = '< '.concat(legendValues[0].toString());
  cm.appendChild(createElementFromHTML(
    `<span class="legendspan" style="background-color:${colorScale(legendValues[0] - 1)};"></span> <label >${firstLegendString}</label><br>`
  ));
  for (var i = 1; i < legendValues.length; i++) {
    var legendString = ''.concat(legendValues[i - 1].toString(), ' - ', legendValues[i].toString());
    cm.appendChild(createElementFromHTML(
      `<span class="legendspan" style="background-color:${colorScale(legendValues[i] - 1)};"></span> <label >${legendString}</label><br>`
    ))
  }
  var lastLegendString = '> '.concat(legendValues[legendValues.length - 1].toString());
  cm.appendChild(createElementFromHTML(
    `<span class="legendspan" style="background-color:${colorScale(legendValues[legendValues.length - 1])};"></span> <label >${lastLegendString}</label><br>`
  ));
}

function draw_map_d3(topo, fill_fn) {
  // TODO: This recreates all geometry, we should only update the final fill state.
  svg.selectAll("g").remove();
  svg.append("g")
    .selectAll("path")
    .data(topo.features)
    .enter()
    .append("path")
    .attr("d", d3.geoPath().projection(projection))     // draw each country
    .attr("fill", fill_fn);                             // set the color of each country
}


export function draw_map(topo, state) {
    draw_map_d3(topo, function (f) {
      let ctag = f.properties.AGS;
      let cr = state.regions.find(e => e.tag == ctag);
      return colorScale(avg7_incidence(cr));
    });
  }