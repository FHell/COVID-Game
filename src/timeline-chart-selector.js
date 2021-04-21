export default class TimelineChartSelector {
  constructor(container, state, timelineChart) {
    this.container = container;
    this.timelineChart = timelineChart;

    this.initOptions(state);

    this.$select = $('<select class="form-control form-control-sm"></select>')
      .appendTo(this.container)
      .on('change', this.handleChange.bind(this))
      .append(this.options.map((option, i) => {
        return $('<option></option>')
          .text(option.label)
          .attr('value', i + 1);
      }));

  }

  initOptions(state) {
    this.state = state;
    this.options = [
      {
        label: 'Infections',
        data: [state.country.I],
        properties:
        {
          start_drawing: state.step_no,
          y_max: 400,
        }
      },
      {
        label: 'Infections (cumulative)',
        data: [state.country.cumulative_infections],
        properties:
        {
          start_drawing: state.step_no,
          y_max: 400,
        }
      },
      {
        label: 'Infections (cumulative, per strain)',
        data: [
          state.country.cumulative_infections_original_only,
          state.country.cumulative_infections_mutation_only,
        ],
        properties:
        {
          start_drawing: state.step_no,
          y_max: 400,
        }
      },
      {
        label: 'Deaths',
        data: [state.country.deaths],
        properties:
        {
          start_drawing: state.step_no,
          y_max: 10,
        }
      },
      {
        label: 'Deaths (cumulative)',
        data: [state.country.cumulative_deaths],
        properties:
        {
          start_drawing: state.step_no,
          y_max: 10,
        }
      },
      {
        label: '7-day average incidence',
        data: [state.country.seven_d_incidence],
        properties:
        {
          start_drawing: state.start_no,
          y_max: 10,
        }
      },
    ];

  }

  updateState(state) {
    this.initOptions(state);
    this.handleChange();
  }

  handleChange() {
    this.timelineChart.setData(
      this.options[this.$select.val() - 1].data
    );
    this.timelineChart.setProperties(this.options[this.$select.val() - 1].properties)
  }
}
