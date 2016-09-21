/**
 * Montion Bubble graph
 */
function MotionBubble(config) {
    UiBuilder.call(this, config);
    this.rscale = 0;
    this.damper = 0.15;
    this.layoutGravity = -0.01;
    if (config) {
        this.initialize();
    }
}

MotionBubble.prototype = new UiBuilder();
MotionBubble.prototype.constructor = MotionBubble;

/**
 * Se ecnarga de preparar los contenedores donde se renderizarán
 * Los componentes.
 */
MotionBubble.prototype.prepareContainer = function () {
    UiBuilder.prototype.prepareContainer.call(this);
    var $viz = $("#" + this.vizId);
    $viz.width(this.width);

    this.center = {
        x: this.width / 2,
        y: this.diameter / 2
    };
}

/**
 * Se encarga de construir los filtros de la parte superior
 */
MotionBubble.prototype.buildFilter = function () {
    var filters = [];
    if (this.config.filters.length > 0) {
        filters.push({
            text: "Todos",
            value: "all"
        });
        filters = filters.concat(this.config.filters);
    }
    var container = this.headerId;
    var $footer = $("#" + container);
    var $toogle = $("<div></div>");
    $toogle.addClass("bubble-toogle");
    $toogle.attr("id", container + "-toogle");
    $footer.append($toogle);
    var thiz = this;
    var toggle = d3plus.form()
        .data(filters)
        .container("#" + container + "-toogle")
        .id("value")
        .text("text")
        .type("toggle")
        .draw();

    $footer.find(".d3plus_toggle").on("click", function (d) {
        var $target = $(this)[0];
        var data = $target["__data__"];
        if (typeof data != "undefined") {
            if (data.value !== "all") {
                $("#" + thiz.legendId).hide();
                $("#" + thiz.legendRightId).hide();
                thiz.groupAll(thiz.circles, data.value);
            } else {
                $("#" + thiz.legendId).show();
                $("#" + thiz.legendRightId).show();
                thiz.groupAll(thiz.circles);
            }
        }
    });
}

MotionBubble.prototype.getMaxRadius = function (attr) {
    var max = null;
    for (var key in this.filtersData[attr]) {
        var d = this.filtersData[attr][key];
        if (typeof d != "string") {
            max = max == null || max < d.r ? d.r : max;
        }
    }
    return max;
}

/**
 * Se encarga de calcular el centro de los filtros
 */
MotionBubble.prototype.calculateFilterCenter = function () {
    this.filterCenters = {};
    var $viz = $("#" + this.vizId);
    var cols = this.config.cols;
    //var p = this.config.p;
    var xpadding = 80;
    var ypadding = 100;
    var txtHeight = 40;
    for (var attr in this.filters) {
        this.filterCenters[attr] = {};
        var len = this.filters[attr].length;
        cols = this.config.cols;
        cols = len < cols ? len : cols;
        var nrows = parseInt(len / cols);
        nrows = nrows == 1 ? 2 : nrows;
        var dx = (this.width - xpadding * 2) / cols;
        var dy = (this.diameter - ypadding) / nrows;
        var idx = 1;
        var y0 = ypadding / 2;
        var x0 = xpadding / 2;
        var maxR = 0;
        var prevX = 0;
        for (var i = 0; i < len; i++) {
            var strTmp = this.filters[attr][i];
            var fdata = this.filtersData[attr][strTmp];
            fdata.r = Math.sqrt(fdata.r);
            if (idx > cols) {
                idx = 1;
                y0 += dy + maxR + txtHeight;
                maxR = 0;
            }
            // se calcula la y
            maxR = maxR < fdata.r ? fdata.r : maxR;
            var row = parseInt(i / cols);
            var y = y0 + dy;
            y += txtHeight;
            //se calcula la x
            
            var x = 0;
            //si es el primer filtercenter, se parte del xpadding. 
            //Además el centro del primer filtro debe estar en dx/2
            if(idx === 1){
                x = xpadding + dx/2;
            } else {
            // el filtercenter actual debe encontrarse a dx del filtro anterior
                x = prevX + dx;
            }

            //se almacena el x actual como x previa para la siguiente corrida
            prevX = x;

            //x = x - fdata.r * 0.3;
            //se actualiza el heigth
            this.filterCenters[attr][strTmp] = {
                x: x,
                y: y,
                r: fdata.r,
                size: fdata.size,
                filter: strTmp
            }

            idx += 1;
        }
        this.filtersData[attr]["MAX_Y"] = y + dy + maxR + ypadding;
    }
    //se redimensiona el container
    this.resizeViz(this.diameter + ypadding);
}




/**
 * Se sobrescribe el método rollup del base builder
 */
MotionBubble.prototype.roolup = function (v, sample) {
    var data = {};
    var thiz = this;
    for (var attr in sample) {
        this.roolupFilters(v, attr);
        for (var i = 0; i < v.length; i++) {
            if (attr == this.config.time) {
                data[attr] = v.map(function (d) {
                    if (thiz.timeArray.indexOf(d[attr]) == -1) {
                        thiz.timeArray.push(d[attr]);
                    }
                    return d[attr];
                });
            } else if (attr == this.config.size) {
                data[attr] = d3.sum(v, function (d) {
                    return d[attr];
                });
            } else {
                data[attr] = v[0][attr];
            }
        }
    }
    return data;
}

/**
 * Se encarga de preprocesar a los datos
 */
MotionBubble.prototype.buildNodes = function (data, filter) {
    var thiz = this;
    UiBuilder.prototype.buildNodes.call(this, data, filter);
    //darray = darray.children;
    var darray = data;

    var max = d3.max(darray, function (d) {
        return d[thiz.config.size];
    });

    var min = d3.min(darray, function (d) {
        return d[thiz.config.size];
    });

    this.sizeData = {};
    this.sizeData.max = max;
    this.sizeData.min = min;

    min = min == max ? 0 : min;
    var nChilds = darray.length - 10;
    nChilds = nChilds < 5 ? 5 : nChilds;
    nChilds = nChilds > 30 ? 30 : nChilds;
    var maxR = this.width / nChilds;
    this.rscale = d3.scale.pow()
        .exponent(0.5)
        .domain([min, max])
        .range([this.config.bubble.minRadius, maxR]);

    thiz.clusters = _.uniq(_.pluck(darray, thiz.config.colour));        
    thiz.deltaY = Math.floor(thiz.diameter / thiz.clusters.length);

    darray.forEach(function (d) {
 
        d.clusterX = thiz.center.x;
        d.clusterY = thiz.deltaY + _.indexOf(thiz.clusters, d[thiz.config.colour]) * thiz.deltaY;

        d.value = d[thiz.config.size];
        d.r = thiz.rscale(d.value);
        // se sumarizan los radios de los elementos a filtrar
        for (var attr in thiz.filters) {
            thiz.filtersData[attr][d[attr]].r += d.r * d.r;
        };
    });

    darray = darray.sort(function (a, b) {
        return b[thiz.config.size] - a[thiz.config.size];
    });

    this.calculateFilterCenter();
    return darray;
}

/**
 * Graphic builder.
 */
MotionBubble.prototype.builder = function (data) {
    d3.select("#" + this.vizId).html("");
    var svg = d3.select("#" + this.vizId)
        .append("svg")
        .attr("width", this.width)
        .attr("height", this.diameter);
    this.buildFilter();
    var thiz = this;
    this.nodes = this.buildNodes(data);
    this.circles = svg
        .selectAll("circle")
        .data(this.nodes)
        .enter()
        .append("circle")
        .attr("class", "node")
        .attr("r", 0)
        .attr("cx", function (d) {
            return d.x;
        })
        .attr("cy", function (d) {
            return d.y;
        })
        .attr("fill", function (d) {
            return thiz.config.color(d[thiz.config.colour]);
        })
        .attr("stroke-width", 1)
        .attr("stroke", function (d) {
            var c = thiz.config.color(d[thiz.config.colour]);
            var b = d3plus.color.legible(c);
            if (c.toUpperCase() == b.toUpperCase()) {
                b = d3plus.color.lighter(c, -0.3);
            }
            return b;
        });

    this.bindMouseEvents(this.circles);
    this.circles.transition()
        .duration(this.config.bubble.animation)
        .attr("r", function (d) {
            return d.r;
        })
    this.start();
    this.groupAll(this.circles);
    if (this.config.legend) {
        this.legend();
        this.legendRight();
    }
}

/**
 *
 */
MotionBubble.prototype.charge = function (d) {
    return -Math.pow(d.r, 2.0) / 8;
};

MotionBubble.prototype.start = function () {
    this.force = d3.layout.force()
        .nodes(this.nodes)
        .size([this.width, this.diameter]);
};

MotionBubble.prototype.tickNodes = function (e, moveCallback) {
    var thiz = this;
    this.circles
        .each(moveCallback(e.alpha))
        .attr("cx", function (d) {
            return d.x;
        })
        .attr("cy", function (d) {
            return d.y;
        });
}

MotionBubble.prototype.groupAll = function (nodes, filter) {
    var thiz = this;
    var end = false;
    //momento en el que se realizó esta llamada
    currentTime=  new Date().getTime();
    
    //se almacena en thiz la ultima llamada
    thiz.currentFilterTime = currentTime;
    thiz.currentFilter = filter;

    thiz.hideFilters();
    this.force
        .gravity(this.layoutGravity)
        .charge(this.charge)
        .friction(0.9)
        .on("tick", function (e) {

            // if(thiz.currentFilter === filter){
                thiz.tickNodes(e, function (alpha) {
                    if (typeof filter !== "undefined") {
                        if(thiz.config.colour !== filter){
                            if(alpha < 0.08){
                                thiz.force.stop();
                            }
                        } else {
                        return thiz.moveTowardsFilter(alpha, filter);
                        }
                        // return thiz.moveTowardsCenter(alpha);
                        return thiz.moveTowardsFilter(alpha, filter);
                    }
                    if(alpha < 0.04){
                        thiz.force.stop();
                    }
                    return thiz.moveTowardsCenter(alpha);
                });
            // }
            }).on('end', function() {        
                // if(thiz.currentFilter === filter){
                    thiz.force
                    .on('tick', function(e) {                       
                        thiz.circles      
                        .each(function(d) {     
                        
                          if(!filter){      
                            d.x += (thiz.center.x - d.x) * thiz.damper * e.alpha;       
                            d.y += (thiz.center.y - d.y) * thiz.damper * e.alpha;       
                        }else{        
                            
                            var target = thiz.filterCenters[filter][d[filter]];     
                            var xpadding = 80;      
                            d3.select(this).attr("data-filter", d[filter]);     
                            d.x = d.x + (target.x - d.x) * thiz.damper * e.alpha;       
                            d.x = d.x <= 0 ? d.r * 2 : d.x;     
                            d.x = (d.x + d.r) > thiz.width + xpadding ? d.x - d.r : d.x;        
                            d.y = d.y + (target.y - d.y) * thiz.damper * e.alpha;       
                        }     
                    })      
                    .attr("cx", function (d) {      
                        return d.x;     
                    })      
                    .attr("cy", function (d) {      
                        return d.y;     
                    });     
                });     

                if(!end){
                    thiz.force.start();
                    end = true;
                }

        // }
        });

    if (typeof filter != "undefined") {
        this.resizeViz(this.filtersData[filter]["MAX_Y"]);

        /*
        Se invoca al metodo que renderiza los labels de los grupos luego de
        1 segundo para darle tiempo a que las burbujas se reposicionen.
        */
        setTimeout(function (curtime) {
            //si esta llamada es la última realizada, se dibujan los filtros sino se ignora
            if(thiz.currentFilterTime === curtime){
                thiz.displayFilters(filter);
            }
        }, this.config.bubble.animation, currentTime)
    }
    this.force.start();
};



MotionBubble.prototype.moveTowardsCenter = function (alpha) {
    var thiz = this;
    return function (d) {
        d.x += (d.clusterX - d.x) * alpha * thiz.damper;
        d.y += (d.clusterY - d.y) * alpha * thiz.damper;
        return d.y;
    };
};

MotionBubble.prototype.moveTowardsFilter = function (alpha, filter) {
    var thiz = this;
    var xpadding = 80;
    return function (d) {
        var target = thiz.filterCenters[filter][d[filter]];
        d3.select(this).attr("data-filter", d[filter]);
        if(filter !== thiz.config.colour){      
        var deltaY = Math.round(( target.r) / thiz.clusters.length);        
        var targetY = deltaY + _.indexOf(thiz.clusters, d[thiz.config.colour]) * deltaY + target.y;     
        d.x = d.x + (target.x - d.x) * thiz.damper * alpha;     
        d.x = d.x <= 0 ? d.r * 2 : d.x;     
        d.x = (d.x + d.r) > thiz.width + xpadding ? d.x - d.r : d.x;        
        d.y = d.y + (targetY - d.y) * thiz.damper * alpha;      
      }else{
        d.x = d.x + (target.x - d.x) * thiz.damper * alpha;
        d.x = d.x <= 0 ? d.r * 2 : d.x;
        d.x = (d.x + d.r) > thiz.width + xpadding ? d.x - d.r : d.x;
        d.y = d.y + (target.y - d.y) * thiz.damper * alpha;
    }
    };
};

/**
 * Se encarga de otener la mayor X e Y de los nodos luego del filtrado
 * para determinar la ubicación de los labels.
 */
MotionBubble.prototype.getLabelXY = function (filter) {

    var xy = {
        x: 0,
        y: 0
    };

    $("#" + this.vizId).find("[data-filter= '" + filter + "']")
        .each(function (e) {
            var cx = parseFloat($(this).attr("cx"));
            var cy = parseFloat($(this).attr("cy"));
            var r = parseFloat($(this).attr("r"));
            xy.x = xy.x == 0 || (cx - r) < xy.x ? cx - r : xy.x;
            xy.y = xy.y == 0 || (cy + r * 2) > xy.y ? cy + r * 2 : xy.y;
        });
    return xy;
}

MotionBubble.prototype.text = function (node, center, filter) {
    var thiz = this;
    var g = node
        .append("g")
        .attr("class", "filters")
        .filter(function (d) {
            return typeof center[d].r != "undefined";
        })
        .attr("transform", function (d) {
            var dt = center[d];
            var pts = thiz.getLabelXY(d);
            pts.x += dt.r;
            pts.y += 25;
            return "translate(" + pts.x + "," + pts.y + ")";
        })
        .attr("text-anchor", "middle");

    var txt = g.append("text")
        .attr("class", "labels")
        .text(function (d) {
            return thiz.config.format.text(d);
        });

    var ntxt = g.append("text")
        .attr("class", "size")
        .text(function (d) {
            var dt = center[d];
            return thiz.config.format.number(dt.size);
        })
        .attr("y", 20);
    return g;
}

MotionBubble.prototype.displayFilters = function (attr) {
    var thiz = this;
    var data = d3.keys(this.filterCenters[attr]);
    var center = thiz.filterCenters[attr];
    var filters = d3.select("#" + this.vizId)
        .select("svg")
        .selectAll(".filters")
        .data(data)
        .enter();
    return thiz.text(filters, center, attr);
};

MotionBubble.prototype.hideFilters = function () {
    d3.select("#" + this.vizId).selectAll(".filters").remove();
    this.resizeViz(this.diameter);
};


MotionBubble.prototype.legend = function () {
    var thiz = this;
    //radio minimo según el dato más pequeño
    var rmin = thiz.rscale(this.sizeData.min);
    //radio máximo según el dato más grande
    var rmax = thiz.rscale(this.sizeData.max);

    var container = d3.select("#" + this.legendId)
        .style("margin-top", (-(rmax * 3 + 100)) + "px")
        .attr("class", "legend-container hidden-sm hidden-xs");

    var overview = container.append("div").attr("class", "legend-overview");
    if(this.config.legend.title){
        overview.append("h3").text(this.config.legend.title);
    }
    overview.append("p").text(this.config.legend.description);

    var svg = container.append("svg");

    if(this.config.legend.footer){
        var footer = container.append("div").attr("class", "legend-footer");
        footer.append("p").text(this.config.legend.footer);
    }
    var node = svg.append("g")
        .attr("transform", "translate(" + rmax + ", " + rmax + ")");

    function circle(node, r) {
        return node.append("circle")
            .attr("r", r)
            .attr("class", "legend")
    }

    function text(node, size) {
        var txt = "_____ ";
        txt += thiz.config.format.number(size);
        return node.append("text")
            .attr("x", rmax - rmin)
            .text(txt);
    }

    text(node, this.sizeData.max).attr("y", -(rmax-10));
    circle(node, rmax).attr("cy", 10);

    text(node, this.sizeData.min).attr("y", (rmax-10));
    circle(node, rmin).attr("cy", rmax );

}


MotionBubble.prototype.legendRight = function () {
    var thiz = this;
    //radio minimo según el dato más pequeño
    var rmin = thiz.rscale(this.sizeData.min);
    //radio máximo según el dato más grande
    var rmax = thiz.rscale(this.sizeData.max);

    var container = d3.select("#" + this.legendRightId)
        .style("margin-top", rmin*3 + "px")
        .style("position", "absolute")
        .style("right", "0px")
        .style("width", "250px")
        .attr("class", "legend-container hidden-sm hidden-xs");


    var svg = container.append("svg");
    svg.style("height","500px");

    var node = svg.append("g")
        .attr("transform", "translate(" + rmin + ", " + rmin + ")");

    function circle(node, r) {
        return node.append("circle")
            .attr("r", r)
            .attr("class", "legend")
    }

    function texto(node, txt) {
        return node.append("text")
            .attr("x", rmax - rmin)
            .text(txt);
    }

    var rref = rmin/2;

    var k = 1;
    for (var key in this.filters[this.config.label]) {

        circle(node, rref).attr("cy", 4*k*rref ).attr("cx", 0 ).attr("class", "node").attr("fill", this.config.color(  this.filters[this.config.label][key] ));
        texto(node, this.filters[this.config.label][key]).attr("y", 4*k*rref + rref/2).attr("x", 2*rref );  

        k++;
    }



}