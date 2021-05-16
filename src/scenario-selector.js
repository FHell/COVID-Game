import {
  init_state_inc,
  init_state_0,
  init_state_2y
} from './state-handling.js';

export default class ScenarioSelector {
  constructor(container, state, data, reseter) {
    this.container = container;
    this.data = data;

    this.initOptions(state);

    this.$select = $('<select class="form-control form-control-sm"></select>')
      .appendTo(this.container)
      .on('change', reseter.bind(this))
      .append(this.options.map((option, i) => {
        return $('<option></option>')
          .text(option.label)
          .attr('value', i + 1);
      }));
    
    this.initScenario()
  }

  initOptions(state) {
    this.state = state;
    this.options = [
      {
        label: 'Two years of covid',
        init: init_state_2y,
      },
      {
        label: 'Incidence 22.2.',
        init: init_state_inc,
      },
      {
        label: 'Incidence 0.',
        init: init_state_0,
      }
    ];

  }

  updateState(state) {
    this.initOptions(state);
  }

  initScenario() {
    this.options[this.$select.val() - 1].init(this.state, this.data);
  }
}
