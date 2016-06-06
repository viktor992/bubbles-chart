var color = d3plus.color.scale;
var offset = 5;

/**
 */
function BubbleChart(options) {
    this.dataArray = [];
    this.timeArray = [];
    this.timeSelection = [];
    this.config = {};
    this.config.defaultColor = "#ddd";
    this.initialize(options);
}

/**
 *
 */
BubbleChart.prototype.initialize = function (options) {
    for (var attr in options) {
        this.config[attr] = options[attr];
    }

    this.prepareContainer();
}

/**
 * D3 Selectable
 *
 * Bind selection functionality to `ul`, an ancestor node selection
 * with its corresponding child selection 'li'.
 * Selection state update rendering takes place in the `update` callback.
 *
 */
BubbleChart.prototype.selectable = function (ul, li, update) {
    function isParentNode(parentNode, node) {
        if (!node) return false;
        if (node === parentNode) return true;
        return isParentNode(parentNode, node.parentNode);
    }

    function selectFirst(selection) {
        selection.each(function (d, i) {
            if (i === 0) d._selected = true;
        });
    }

    function selectLast(selection) {
        selection.each(function (d, i, j) {
            if (i === selection[j].length - 1) d._selected = true;
        });
    }

    var lastDecision;

    function select(d, node) {
        var parentNode = ul.filter(function () {
                return isParentNode(this, node);
            }).node(),
            lis = li.filter(function () {
                return isParentNode(parentNode, this);
            });
        // select ranges via `shift` key
        if (d3.event.shiftKey) {
            var firstSelectedIndex, lastSelectedIndex, currentIndex;
            lis.each(function (dl, i) {
                if (dl._selected) {
                    firstSelectedIndex || (firstSelectedIndex = i);
                    lastSelectedIndex = i;
                }
                if (this === node) currentIndex = i;
            });
            var min = Math.min(firstSelectedIndex, lastSelectedIndex, currentIndex);
            var max = Math.max(firstSelectedIndex, lastSelectedIndex, currentIndex);

            // select all between first and last selected
            // when clicked inside a selection
            lis.each(function (d, i) {
                // preserve state for additive selection
                d._selected = (d3.event.ctrlKey && d._selected) || (i >= min && i <= max);
            });
        } else {
            // additive select with `ctrl` key
            if (!d3.event.ctrlKey) {
                lis.each(function (d) {
                    d._selected = false;
                });
            }
            d._selected = !d._selected;
        }
        // remember decision
        lastDecision = d._selected;
        update();
    }

    ul.selectAll("li")
        .on('mousedown', function (d) {
            select(d, this);
        }).on('mouseover', function (d) {
            // dragging over items toggles selection
            if (d3.event.which) {
                d._selected = lastDecision;
                update();
            }
        });


    var keyCodes = {
        up: 38,
        down: 40,
        home: 36,
        end: 35,
        a: 65
    };

    ul.on('keydown', function () {
        if (d3.values(keyCodes).indexOf(d3.event.keyCode) === -1) return;
        if (d3.event.keyCode === keyCodes.a && !d3.event.ctrlKey) return;

        var focus = ul.filter(':focus').node();
        if (!focus) return;

        d3.event.preventDefault();

        var scope = li.filter(function (d) {
            return isParentNode(focus, this);
        });
        var selecteds = scope.select(function (d) {
            return d._selected;
        });

        if (!d3.event.ctrlKey) {
            scope.each(function (d) {
                d._selected = false;
            });
        }

        var madeSelection = false;
        switch (d3.event.keyCode) {
            case keyCodes.up:
                selecteds.each(function (d, i, j) {
                    if (scope[j][i - 1]) madeSelection = d3.select(scope[j][i - 1]).data()[0]._selected = true;
                });
                if (!madeSelection) selectLast(scope);
                break;
            case keyCodes.down:
                selecteds.each(function (d, i, j) {
                    if (scope[j][i + 1]) madeSelection = d3.select(scope[j][i + 1]).data()[0]._selected = true;
                });
                if (!madeSelection) selectFirst(scope);
                break;
            case keyCodes.home:
                selectFirst(scope);
                break;
            case keyCodes.end:
                selectLast(scope);
                break;
            case keyCodes.a:
                scope.each(function (d) {
                    d._selected = !d3.event.shiftKey;
                });
                break;
        }
        update();
    });
}

BubbleChart.prototype.prepareContainer = function () {
    this.diameter = $(this.config.container).height();
    this.width = $(this.config.container).width();

    this.diameter = this.diameter < 500 ? 500 : this.diameter;
    this.config.scope = this.config.container.replace("#", "");
    this.vizId = this.config.scope + "-viz";
    this.footerId = this.config.scope + "-footer";
    var $viz = $("<div />");
    $viz.attr("id", this.vizId);

    var $footer = $("<div />");
    $footer.attr("id", this.footerId);

    $(this.config.container).append($viz);
    $(this.config.container).append($footer);
    d3.select(self.frameElement).style("height", this.diameter + "px");

}

/**
 *
 */
BubbleChart.prototype.builder = function (data) {
    var thiz = this;
    var format = {
        text: function (text, key) {
            return d3plus.string.title(text);
        },
        number: function (number, data) {
            return d3plus.number.format(number)
        }
    };

    this.config.format = this.config.format ? this.config.format : {};
    this.config.format = d3plus.object.merge(format, this.config.format);


    var bubble = d3.layout.pack()
        .sort(function (a, b) {
            return a.value - b.value;
        })
        .size([this.width, this.diameter])
        .padding(1.5);

    var vizId = "#" + this.vizId;
    $(vizId).html("");
    var svg = d3.select(vizId)
        .append("svg")
        .attr("width", this.width)
        .attr("height", this.diameter)
        .attr("class", "bubble");

    var node = svg.selectAll(".node")
        .data(bubble.nodes(this.buildNodes(data))
            .filter(function (d) {
                return !d.children;
            }))
        .enter().append("g")
        .attr("class", "node")
        .on('mouseover', function (d) {
            thiz.createTooltip(d);
        })
        .on('mouseout', function (d) {
            d3plus.tooltip.remove(thiz.config.scope + "_visualization_focus");
        })
        .attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        });

    var gnode = node.append("g");
    var main = this.circle(gnode)
        .style("stroke", function (d) {
            var c = color(d[thiz.config.label]);
            return d3plus.color.legible(c);
        })
        //.style("stroke-width", "1px");

    if (this.config.percentage) {
        this.circle(gnode, {
            "class": "main-shape"
        });
        this.circle(gnode, {
                offset: offset
            })
            .style("stroke", "#FFF")
            .style("stroke-width", "2px");

        this.buildGauge(node);

    } else {
        this.circle(gnode);
        this.text(gnode);
    }

}

/**
 * Build a svg text node.
 */
BubbleChart.prototype.text = function (node, options) {

    function isLikeWhite(c) {
        var dc = 235;
        var rgb = d3.rgb(c);
        return rgb.r >= dc && rgb.g >= dc && rgb.b >= dc;
    }

    var thiz = this;
    return node.append("text")
        .attr("class", "wrap")
        .style("fill", function (d) {
            var c = color(d[thiz.config.label]);
            c = d3plus.color.text(c);
            if (isLikeWhite(c)) {
                return thiz.config.defaultColor;
            }
            return c;
        })
        .text(function (d) {
            return thiz.config.format.text(d[thiz.config.label]);
        });
}

/**
 * Build a svg circle node.
 */
BubbleChart.prototype.circle = function (node, options) {
    var thiz = this;
    options = typeof options == "undefined" ? {} : options;
    options.offset = typeof options.offset == "undefined" ? 0 : options.offset;
    options.class = typeof options.class == "undefined" ? "shape" : options.class;

    return node.append("circle")
        .attr("r", function (d) {
            if (d.r < options.offset) {
                return 0;
            }
            return d.r - options.offset;
        })
        .attr("class", options.class)
        .style("fill", function (d) {
            if (typeof options.fill != "undefined") {
                return options.fill;
            }
            return color(d[thiz.config.label]);
        });
}

/**
 *
 */
BubbleChart.prototype.data = function (data) {
    this.dataArray = $.extend([], data, true);
    this.builder(data)
    if (typeof this.config.time != "undefined") {
        this.timeline();
    }
    this.wrapText();
}

/**
 * Wrapping the text using D3plus text warpping. D3plus automatically
 * detects if there is a <rect> or <circle> element placed directly
 * before the <text> container element in DOM, and uses that element's
 * shape and dimensions to wrap the text.
 */
BubbleChart.prototype.wrapText = function () {

    $("#" + this.vizId).find(".wrap")
        .each(function () {
            d3plus.textwrap()
                .container(d3.select(this))
                .resize(true)
                .align("middle")
                .valign("middle")
                .draw();
        })
}

/**
 *
 */
BubbleChart.prototype.buildGauge = function (node) {
    var g = node.append("g");
    var thiz = this;

    g.append("clipPath")
        .attr("id", function (d) {
            return "g-clip-" + d3plus.string.strip(d[thiz.config.label]);
        })
        .append("rect")
        .attr("id", function (d) {
            return "g-clip-rect" + d3plus.string.strip(d[thiz.config.label]);
        })
        .attr("y", function (d) {
            return -d.r + offset;
        })
        .attr("x", function (d) {
            return -d.r + offset;
        })
        .attr("width", function (d) {
            if (2 * d.r < offset) {
                return 0;
            }
            return 2 * d.r - offset;
        })
        .attr("height", function (d) {
            if (2 * d.r < offset) {
                return 0;
            }
            var p = thiz.config.percentage(d);
            p = parseInt(p);
            return p < 0 ? 0 : p;
        });


    this.circle(g, {
            offset: offset,
            fill: "#FFF"
        })
        .attr("clip-path", function (d) {
            return "url(#" + "g-clip-" + d3plus.string.strip(d[thiz.config.label]) + ")";
        });

    this.text(g);
}


/**
 * This methdod build the tooltip.
 */
BubbleChart.prototype.createTooltip = function (d) {
    var thiz = this;
    var data = [{
        "value": thiz.config.format.number(d[thiz.config.size]),
        "name": d3plus.string.title(thiz.config.size)
    }];

    data = this.config.tooltip ? this.config.tooltip(d) : data;
    //se calcula el tamaño del tooltip
    var maxWidth = 300;
    var maxHeigth = 10 + 35 * data.length;

    var config = {
        "id": thiz.config.scope + "_visualization_focus",
        "x": d3.event.clientX - maxWidth / 2,
        "y": d3.event.clientY - maxHeigth,
        "allColors": true,
        "fixed": true,
        "size": "small",
        "color": color(d[thiz.config.label]),
        "fontsize": "15px",
        "data": data,
        "width": maxWidth,
        "max_width": maxWidth,
        "mouseevents": this,
        "arrow": true,
        "anchor": "top left",
        "title": d3plus.string.title(d[thiz.config.label]),
    }
    d3plus.tooltip.create(config);
}

/**
 * This method prepare the data for the visualization.
 */
BubbleChart.prototype.buildNodes = function (data) {
    var thiz = this;
    var d = this.groupingData(data);
    for (var i = 0; i < d.length; i++) {
        d[i].value = d[i][thiz.config.size];
    }
    return {
        children: d
    };
}

/**
 * Prepare the data for the vizualization
 */
BubbleChart.prototype.roolup = function (v, sample) {
    var data = {};
    var thiz = this;
    for (var attr in sample) {
        if (attr == this.config.time) {
            data[attr] = v.map(function (d) {
                if (thiz.timeArray.indexOf(d[attr]) == -1) {
                    thiz.timeArray.push(d[attr]);
                }
                return d[attr];
            });
        } else if (attr == this.config.label) {
            data[attr] = v[0][attr];
        } else if (typeof sample[attr] == "number") {
            data[attr] = d3.sum(v, function (d) {
                return d[attr];
            });
        } else {
            data[attr] = v.map(function (d) {
                return d[attr];
            });
        }
    }
    return data;
}

/**
 * Groupping the array for the visualization
 */
BubbleChart.prototype.groupingData = function (data) {
    var thiz = this;
    var sampleObj = null;
    var tmp = data.filter(function (d) {
        return thiz.timeSelection.length == 0 || thiz.timeSelection.indexOf(d[thiz.config.time]) >= 0;
    });
    var filters = d3.nest()
        .key(function (d) {
            sampleObj = d;
            return d[thiz.config.label];
        })
        .rollup(function (v) {
            return thiz.roolup(v, sampleObj);
        }).entries(tmp);

    return filters.map(function (d) {
        return d.values;
    });
}

/**
 * Tieline change handler
 */
BubbleChart.prototype.onChange = function () {
    var data = $.extend([], this.dataArray, true);
    this.builder(data);
    this.wrapText();
}

/**
 * Build a timeline for the visualization
 */
BubbleChart.prototype.timeline = function () {
    // create lists
    var ul = d3.select("#" + this.footerId)
        .append('ul')
        .attr("class", "timeline")
        .attr('tabindex', 1);
    var thiz = this;
    var time = this.timeArray.map(function (d) {
        var data = {
            "time": d,
            "_selected": true
        };
        return data;
    });

    var li = ul.selectAll('li')
        .data(time)
        .enter()
        .append('li')
        .attr("class", "entry")
        .classed('selected', function (d) {
            return d._selected;
        })
        .append('a')
        .text(function (d) {
            return d.time;
        });


    this.selectable(ul, li, function (e) {
        var selections = []
        ul.selectAll('li')
            .classed('selected', function (d) {
                if (d._selected) {
                    selections.push(d);
                }
                return d._selected;
            })

        //se establecen la selecciones
        thiz.timeSelection = selections.map(function (d) {
            return d.time;
        });
        thiz.onChange();
    });

}