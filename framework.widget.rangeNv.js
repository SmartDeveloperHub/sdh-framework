/*
    #-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=#
      This file is part of the Smart Developer Hub Project:
        http://www.smartdeveloperhub.org/
      Center for Open Middleware
            http://www.centeropenmiddleware.com/
    #-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=#
      Copyright (C) 2015 Center for Open Middleware.
    #-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=#
      Licensed under the Apache License, Version 2.0 (the "License");
      you may not use this file except in compliance with the License.
      You may obtain a copy of the License at
                http://www.apache.org/licenses/LICENSE-2.0
      Unless required by applicable law or agreed to in writing, software
      distributed under the License is distributed on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
      See the License for the specific language governing permissions and
      limitations under the License.
    #-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=#
*/

(function() {

    var normalizeConfig = function normalizeConfig(configuration) {
        if (configuration == null) {
            configuration = {};
        }
        if (typeof configuration.height != "number") {
            configuration.height = 240;
        }
        if (typeof configuration.showFocus != "boolean") {
            configuration.showFocus = true;
        }
        // nvd3 focusHeight is contextHeight
        if (typeof configuration.focusHeight != "number") {
            configuration.focusHeight = configuration.height * 0.5;
            if (!configuration.showFocus) {
                // -30 for leyend
                configuration.focusHeight = configuration.height - 30;
            }
        }
        if (typeof configuration.ownContext != "string") {
            configuration.ownContext = "dafault_rangeNv_Context_id";
        }
        if (typeof configuration.isArea != "boolean") {
            configuration.isArea = false;
        }
        if (typeof configuration.duration != "number") {
            configuration.duration = 250;
        }
        if (typeof configuration.labelFormat != "string") {
            configuration.labelFormat = "%mid%";
        }
        if (typeof configuration.interpolate != "string") {
            configuration.interpolate = "linear";
        }
        if (typeof configuration.background != "string") {
            configuration.background = "rgba(0,0,0,0)";
        }
        if (typeof configuration.axisColor != "string") {
            configuration.axisColor = "#000";
        }
        if (typeof configuration.colors != "object") {
            configuration.colors = undefined;
        }
        if (typeof configuration.showLegend != "boolean") {
            configuration.showLegend = true;
        }return configuration;
    };

    /* rangeNv constructor
     *   element: the DOM element that will contain the rangeNv
     *   data: the data id array
     *   contextId: optional.
     *   configuration: additional chart configuration:
     *      {
     *       ~ donut: boolean - Whether to make a pie graph a donut graph or not.
     *       ~ growOnHover: boolean - For pie/donut charts, whether to increase slice radius on hover or not.
     *       ~ cornerRadius: number - For donut charts only, the corner radius (in pixels) of the slices.
     *       ~ padAngle: number - The percent of the chart that should be spacing between slices.
     *       ~ showLegend: boolean - Whether to display the legend or not.
     *       ~ showLabels: boolean - Show pie/donut chart labels for each slice.
     *       ~ donutRatio: number - Percent of pie radius to cut out of the middle to make the donut. It is multiplied
     *         by the outer radius to calculate the inner radius, thus it should be between 0 and 1.
     *       ~ duration: number - Duration in ms to take when updating chart. For things like bar charts, each bar can
     *         animate by itself but the total time taken should be this value.
     *       ~ labelFormat: string - Format string for the labels. Metric parameters can be used as variables by
     *         surrounding their names with percentages. The metric name can also be accessed with %mid%. For example,
     *         the following is a valid labelFormat: "User: %uid%".
     *      }
     */
    var RangeNv = function RangeNv(element, metrics, contextId, configuration) {

        if(!framework.isReady()) {
            console.error("LinesChart object could not be created because framework is not loaded.");
            return;
        }

        // CHECK D3
        if(typeof d3 === 'undefined') {
            console.error("rangeNv could not be loaded because d3 did not exist.");
            return;
        }

        // CHECK NVD3
        if(typeof nv === 'undefined') {
            console.error("rangeNv could not be loaded because nvd3 did not exist.");
            return;
        }

        // We need relative position for the nvd3 tooltips
        element.style.position = 'inherit';

        this.element = $(element); //Store as jquery object
        this.data = null;
        this.chart = null;
        this.labels = {};
        this.lastExtent = [];
        this.maxY = Number.MIN_VALUE;
        this.minY = Number.MAX_VALUE;
        this.maxT = -8640000000000000;
        this.minT = 8640000000000000;

        // Extending widget
        framework.widgets.CommonWidget.call(this, false, this.element.get(0));

        // Configuration
        this.configuration = normalizeConfig(configuration);

        this.ownContext = configuration.ownContext;

        this.element.append('<svg class="blurable"></svg>');
        this.svg = this.element.children("svg");
        this.svg.get(0).style.minHeight = configuration.height;
        this.svg.get(0).style.backgroundColor = configuration.background;

        this.observeCallback = this.commonObserveCallback.bind(this);

        framework.data.observe(metrics, this.observeCallback , contextId);

    };

    RangeNv.prototype = new framework.widgets.CommonWidget(true);

    RangeNv.prototype.updateData = function(framework_data) {

        var normalizedData = getNormalizedData.call(this,framework_data);
        setTimeInfo(this.minT, this.maxT);

        //Update data
        if(this.chart != null) {
            d3.select(this.svg.get(0)).datum(normalizedData);
            this.chart.update();

        } else { // Paint it for first time
            paint.call(this, normalizedData);
        }

    };

    RangeNv.prototype.delete = function() {

        //Stop observing for data changes
        framework.data.stopObserve(this.observeCallback);

        //Clear DOM
        $(this.svg).empty();
        this.element.empty();

        this.svg = null;
        this.chart = null;

    };

    RangeNv.prototype.updateContext = function(d) {
        this.lastExtent = d;
        framework.data.updateContext(this.ownContext, {from: moment(d[0]).format("YYYY-MM-DD"), to: moment(d[1]).format("YYYY-MM-DD")});
        setTimeInfo(d[0], d[1]);
    };

    // PRIVATE METHODS - - - - - - - - - - - - - - - - - - - - - -

    //Function that returns the value to replace with the label variables
    var replacer = function(resourceId, resource, str) {

        //Remove the initial an trailing '%' of the string
        str = str.substring(1, str.length-1);

        //Check if it is a parameter an return its value
        if(str === "resourceId") { //Special command to indicate the name of the resource
            return resourceId;

        } else { // Obtain its value through the object given the path

            var path = str.split(".");
            var subObject = resource;

            for(var p = 0; p < path.length; ++p) {
                if((subObject = subObject[path[p]]) == null)
                    return "";
            }

            return subObject.toString();
        }

    };

    /**
     * Gets a normalized array of data according to the chart expected input from the data returned by the framework.
     * @param framework_data
     * @returns {Array} Contains objects with 'label' and 'value'.
     */
    var getNormalizedData = function getNormalizedData(framework_data) {
        var labelVariable = /%(\w|\.)+%/g; //Regex that matches all the "variables" of the label such as %mid%, %pid%...

        var series = [];
        this.labels = {};
        //var colors = ['#ff7f0e','#2ca02c','#7777ff','#D53E4F','#9E0142'];
        //Data is represented as an array of {x,y} pairs.
        for (var metricId in framework_data) {
            for (var m in framework_data[metricId]) {

                var metric = framework_data[metricId][m];
                var metricData = metric['data'];

                if(metricData.interval.from < this.minT) {
                    this.minT = metricData.interval.from;
                }
                if(metric.data.interval.to > this.maxT) {
                    this.maxT = metricData.interval.to;
                }

                var timePoint = metricData.interval.from - metricData.step;
                var yserie = metricData.values;

                // Create a replacer for this metric
                var metricReplacer = replacer.bind(null, metricId, metric);

                var genLabel = function genLabel(i) {
                  var lab = this.configuration.labelFormat.replace(labelVariable,metricReplacer);
                  if (i > 0) {
                    lab = lab + '(' + i + ')';
                  }
                  if (lab in this.labels) {
                    lab = genLabel.call(this, ++i);
                  }
                  this.labels[lab] = null;
                  return lab;
                };

                // Generate the label by replacing the variables
                var label = genLabel.call(this, 0);

                // Metric dataset
                var dat = yserie.map(function(dat, index) {
                    timePoint += metricData.step;
                    if(dat > this.maxY) {
                        this.maxY = dat;
                    }
                    if (dat < this.minY) {
                        this.minY = dat;
                    }
                    return {'x': new Date(timePoint), 'y': dat};
                }.bind(this));
                series.push({
                    values: dat,      //values - represents the array of {x,y} data points
                    key: label, //key  - the name of the series.
                    area: this.configuration.isArea
                });
                if (series.length == 1) {
                    series[0]['bar'] = true
                }
            }
        }

        //Line chart data should be sent as an array of series objects.
        return series;
    };

    var paint = function paint(data) {

        var width = this.element.get(0).getBoundingClientRect().width;
        var height = this.element.get(0).getBoundingClientRect().height;

        nv.addGraph(function() {
            var chart = nv.models.lineWithFocusChart()
                .focusHeight(this.configuration.focusHeight)
                .interpolate(this.configuration.interpolate)
                .color(this.configuration.colors)
                .duration(this.configuration.duration)
                .showLegend(this.configuration.showLegend);
                // only affect to focus .How can i force Y axis in context chart?
                // ... i don't know ...
                //.forceY([this.maxY + 10, this.minY]);
            this.chart = chart;

            chart.margin({"top":10,"bottom":14});

            chart.xAxis.tickFormat(function(d) {
                return d3.time.format('%x')(new Date(d));
                });
            chart.x2Axis.tickFormat(function(d) {
                return d3.time.format('%x')(new Date(d))
                });

            chart.yAxis.tickFormat(function(d) {
                if (d >= 1000 || d <= -1000) {
                    return Math.abs(d/1000) + " K";
                } else {
                    return Math.abs(d);
                }
            });

            chart.y2Axis.tickFormat(function(d) {
                if (d >= 1000 || d <= -1000) {
                    return Math.abs(d/1000) + " K";
                } else {
                    return Math.abs(d);
                }
            });

            d3.select(this.svg.get(0))
                .datum(data)
                .call(chart);

            var timer = null;
            chart.dispatch.on('brush', function(extent){
                if(JSON.stringify(this.lastExtent) == JSON.stringify(extent.extent)){
                    // Resize event causes a unwanted brush event in this chart
                    return;
                }
                if (timer) {
                    clearTimeout(timer); //cancel the previous timer.
                    timer = null;
                }
                timer = setTimeout(function() {
                    this.updateContext(extent.extent);
                }.bind(this), 400);
            }.bind(this));

            nv.utils.windowResize(chart.update);
            if (!this.configuration.showFocus) {
                $(".nv-focus").attr("class", "nv-focus hidden");
            }
            // axis color
            $(this.svg).find(".nv-axis").attr('style', 'fill:' + this.configuration.axisColor + ';')
            // leyend color
            $(this.svg).find(".nv-legend-text").attr('style', 'fill:' + this.configuration.axisColor + ';')

            // bigger brush cover
            $(this.svg).find(".nv-brushBackground rect").attr('height', 98);
            $(this.svg).find(".nv-brushBackground rect").attr('transform', 'translate(0,-4)');

            return chart;
        }.bind(this));

    };

    window.framework.widgets.RangeNv = RangeNv;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [], function () { return RangeNv; } );
    }

})();
