export default class TimelineChart {
  constructor(container, data) {
    this.container = container;
    this.$canvas = $('<canvas></canvas>')
      .attr('width', 400)
      .attr('height', 300)
      .appendTo(container);
    this.chart = new Chart(this.$canvas[0].getContext('2d'), {
      type: 'bar',
      data: {
        labels: Array(Math.max(data.length, 28)).fill(0).map((_, i) => i + 1),
        datasets: [{
          data,
          backgroundColor: '#ff5400',
          borderColor: '#d84d08',
          borderWidth: 1,
          barPercentage: 1,
          categoryPercentage: 1,
          datalabels: {
            color: '#fff',
            font: { size: 10 },
            anchor: 'end',
            align: 'top',
            clamp: true,
          },
        },
        {
          data: null,
          backgroundColor: '#3ac1e5',
          borderColor: '#299fbc',
          borderWidth: 1,
          barPercentage: 1,
          categoryPercentage: 1,
          datalabels: {
            color: '#fff',
            font: { size: 10 },
            anchor: 'end',
            align: 'top',
            clamp: true,
          },
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        tooltips: { enabled: false },
        hover: { mode: null },
        scales: {
          xAxes: [{
            stacked: true,
            gridLines: {
              color: '#000',
              zeroLineColor: '#000',
              drawOnChartArea: false,
            },
            ticks: {
              fontSize: 10,
              fontColor: '#000',
            },
          }],
          yAxes: [{
            gridLines: {
              color: '#b8b8b8',
              zeroLineColor: '#000',
            },
            ticks: {
              fontSize: 10,
              fontColor: '#000',
              callback: value => value.toLocaleString(),
              maxTicksLimit: 7,
              suggestedMax: 400,
              suggestedMin: 0,
            },
          }],
        },
        animation: {
          duration: 300,
        },
        legend: { display: false },
      }
    });
  }

  setData(datasets) {
    this.chart.data.datasets.forEach((_, i) => {
      this.chart.data.datasets[i].data = null;
    });
    datasets.forEach((data, i) => {
      this.chart.data.datasets[i].data = data;
    });
    this.chart.update();
  }

  update() {
    for (let i = this.chart.data.labels.length; i < this.chart.data.datasets[0].data.length; i += 1) {
      this.chart.data.labels.push(i + 1);
    }
    this.chart.update();
  }


  setProperties(properties) {
    this.chart.options.scales.xAxes[0].ticks.min = properties.start_drawing;
    this.chart.options.scales.yAxes[0].ticks.suggestedMax = properties.y_max;
    this.chart.update()
  }

}
