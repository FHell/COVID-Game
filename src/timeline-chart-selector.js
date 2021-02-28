export default class TimelineChartSelector {
  constructor(container, state, timelineChart) {
    this.container = container;
    this.state = state;
    this.timelineChart = timelineChart;

    this.options = [
      {
        label: 'Infections',
        data: [ state.country.I ],
      },
      {
        label: 'Infections (cumulative)',
        data: [ state.country.cumulative_infections ],
      },
      {
        label: 'Infections (cumulative, per strain)',
        data: [
          state.country.cumulative_infections_original_only,
          state.country.cumulative_infections_mutation_only,
        ]
      },
      {
        label: 'Deaths',
        data: [ state.country.deaths ],
      },
      {
        label: 'Deaths (cumulative)',
        data: [ state.country.cumulative_deaths ],
      },
      {
        label: '7-day average incidence',
        data: [ state.country.seven_d_incidence ],
      },
    ];

    this.$select = $('<select class="form-control form-control-sm"></select>')
      .appendTo(this.container)
      .on('change', this.handleChange.bind(this))
      .append(this.options.map((option, i) => {
        return $('<option></option>')
          .text(option.label)
          .attr('value',i + 1);
      }));
  }

  handleChange() {
    this.timelineChart.setData(
      this.options[this.$select.val() - 1].data
    );
  }
}
