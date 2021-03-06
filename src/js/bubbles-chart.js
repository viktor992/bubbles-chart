/**
 * Bubble chart visualization builder
 * @param{Config} options
 */
function BubbleChart(options) {
    this.config = new ConfigBuilder();
    for (var attr in options) {
        if (attr == 'format') {
            options.format = d3plus.object.merge(this.config.format, options.format);
        }
        this.config[attr] = options[attr];
    }

    //this.ui = new UiBuilder(this.config);
    if (this.config.type == "tree") {
        this.builder = new TreeBuilder(this.config);
    } else if (this.config.type == "orbit") {
        this.builder = new OrbitBuilder(this.config);
    } else if (this.config.type == "list") {
        this.builder = new ListBuilder(this.config);
    } else if (this.config.type == "motion") {
        this.builder = new MotionBubble(this.config);
    } else {
        this.builder = new BubbleBuilder(this.config);
    }
}

/**
 * Set visualization data.
 * @param{Array} data
 */
BubbleChart.prototype.data = function (data) {
    this.builder.data(data);
}

/**
 * @param event values click|timechange|mouseover|mouseout|mouseenter
 */
BubbleChart.prototype.on = function (event, handler) {
    this.builder.event[event] = handler;
}
