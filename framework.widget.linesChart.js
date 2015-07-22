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
        if (typeof configuration.xlabel != "string") {
            configuration.xlabel = 'X';
        }
        if (typeof configuration.ylabel != "string") {
            configuration.ylabel = 'Y';
        }
        if (typeof configuration.showLegend != "boolean") {
            configuration.showLegend = true;
        }
        if (typeof configuration.showLabels != "boolean") {
            configuration.showLabels = true;
        }
        if (typeof configuration.duration != "number") {
            configuration.duration = 250;
        }
        if (typeof configuration.labelFormat != "string") {
            configuration.labelFormat = "%mid%";
        }
        if (typeof configuration.margin != "object") {
            configuration.margin = {left: 100, right: 70};
        }
        if (typeof configuration.area != "boolean") {
            configuration.area = false;
        }
        if (typeof configuration.colors != "object") {
            configuration.colors = undefined;
        }
        if (!(typeof configuration.interpolate == 'string' || typeof configuration.interpolate == 'function')) {
            configuration.interpolate = 'linear';
        }
        // Demo
        if (typeof configuration._demo != "boolean") {
            configuration.demo = false;
        }

        return configuration;
    };

    /* LinesChart constructor
     *   element: the DOM element that will contain the LinesChart
     *   data: the data id array
     *   contextId: optional.
     *   configuration: additional chart configuration:
     *      {
     *       ~ showLegend: boolean - Whether to display the legend or not.
     *       ~ showLabels: boolean - Show chart labels for each slice.
     *       ~ duration: number - Duration in ms to take when updating chart. For things like bar charts, each bar can
     *         animate by itself but the total time taken should be this value.
     *       ~ labelFormat: string - Format string for the labels. Metric parameters can be used as variables by
     *         surrounding their names with percentages. The metric name can also be accessed with %mid%. For example,
     *         the following is a valid labelFormat: "User: %uid%".
     *       ~ xlabel: string - The x-axis label.
     *       ~ ylabel: string - The y-axis label.
     *       ~ area: boolean - define if a line is a normal line or if it fills in the area.
     *       ~ interpolate: string/function - sets the interpolation mode to the specified string or function
     *         e.g: 'monotone' or 'step'. Default: 'linear'
     *         more information: https://github.com/mbostock/d3/wiki/SVG-Shapes#line_interpolate
     *       ~ margin: object - {'right': number, 'left': number, 'top': number, 'bottom': number} (all optionals)
     *      }
     */
    var LinesChart = function LinesChart(element, metrics, contextId, configuration) {

        if(!framework.isReady()) {
            console.error("LinesChart object could not be created because framework is not loaded.");
            return;
        }

        // CHECK D3
        if(typeof d3 === 'undefined') {
            console.error("LinesChart could not be loaded because d3 did not exist.");
            return;
        }

        // CHECK NVD3
        if(typeof nv === 'undefined') {
            console.error("LinesChart could not be loaded because nvd3 did not exist.");
            return;
        }

        // We need relative position for the nvd3 tooltips
        element.style.position = 'inherit';

        this.element = $(element); //Store as jquery object
        this.data = null;
        this.chart = null;
        this.labels = {};

        // Extending widget
        framework.widgets.CommonWidget.call(this, false, this.element.get(0));

        // Configuration
        this.configuration = normalizeConfig(configuration);

        this.element.append('<svg class="blurable"></svg>');
        this.svg = this.element.children("svg");
        this.svg.get(0).style.minHeight = this.configuration.height + "px";

        this.observeCallback = this.commonObserveCallback.bind(this);

        framework.data.observe(metrics, this.observeCallback , contextId);

    };

    LinesChart.prototype = new framework.widgets.CommonWidget(true);

    LinesChart.prototype.updateData = function(framework_data) {

        var normalizedData = getNormalizedData.call(this,framework_data);

        //Update data
        if(this.chart != null) {
            d3.select(this.svg.get(0)).datum(normalizedData);
            this.chart.color(this.generateColors(framework_data, this.configuration.colors));
            this.chart.update();

        } else { // Paint it for first time
            paint.call(this, normalizedData, framework_data);
        }

    };

    LinesChart.prototype.delete = function() {

        //Stop observing for data changes
        framework.data.stopObserve(this.observeCallback);

        //Remove resize event listener
        if(this.resizeEventHandler != null) {
            $(window).off("resize", this.resizeEventHandler);
            this.resizeEventHandler = null;
        }

        //Clear DOM
        $(this.svg).empty();
        this.element.empty();

        this.svg = null;
        this.chart = null;

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
                var metricData = framework_data[metricId][m]['data'];

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
                // Demo
                // Generate the label by replacing the variables
                //var label = genLabel.call(this, 0);
                var label;
                if (this.configuration._demo) {
                    label = "commits";
                    if (metric.info.request.params.aggr == "avg") {
                        label += " by day";
                    }
                } else {
                    // Generate the label by replacing the variables
                    label = genLabel.call(this, 0);
                }

                // Metric dataset
                var dat = yserie.map(function(dat, index) {
                    timePoint += metricData.step;
                    return {'x': new Date(new Date(timePoint).getTime()), 'y': dat};
                });
                series.push({
                    values: dat,      //values - represents the array of {x,y} data points
                    key: label, //key  - the name of the series.
                    //color: colors[series.length],  //color - optional: choose your own line color.
                    area: this.configuration.area
                });
            }
        }

        //Line chart data should be sent as an array of series objects.
        return series;
    };

    var paint = function paint(data, framework_data) {

        var width = this.element.get(0).getBoundingClientRect().width;
        var xlabel = this.configuration.xlabel;
        var ylabel = this.configuration.ylabel;

        nv.addGraph(function() {
            var chart = nv.models.lineChart()
                    .height(this.configuration.height)
                    .margin(this.configuration.margin)  //Adjust chart margins to give the x-axis some breathing room.
                    .useInteractiveGuideline(true)  //We want nice looking tooltips and a guideline!
                    .duration(350)  //how fast do you want the lines to transition?
                    .showLegend(this.configuration.showLegend)       //Show the legend, allowing users to turn on/off line series.
                    .showYAxis(true)        //Show the y-axis
                    .showXAxis(true)        //Show the x-axis
                    .interpolate(this.configuration.interpolate) // https://github.com/mbostock/d3/wiki/SVG-Shapes#line_interpolate
                    .color(this.generateColors(framework_data, this.configuration.colors))
                ;
            this.chart = chart;
            chart.xAxis     //Chart x-axis settings
                .axisLabel(this.configuration.xlabel)
                .tickFormat(function(d) {
                    return d3.time.format('%x')(new Date(d));
                });

            chart.yAxis     //Chart y-axis settings
                .axisLabel(this.configuration.ylabel)
                .tickFormat(function(tickVal) {
                    if (tickVal >= 1000 || tickVal <= -1000) {
                        return tickVal/1000 + " K";
                    } else {
                        return tickVal;
                    }
                })


            d3.select(this.svg.get(0))   //Select the <svg> element you want to render the chart in.
                .datum(data)          //Populate the <svg> elemen
                .call(chart);         //Finally, render the chart!

            //Update the chart when window resizes.
            this.resizeEventHandler = function() { chart.update() };
            $(window).resize(this.resizeEventHandler);

          return chart;
        }.bind(this));

    };

    window.framework.widgets.LinesChart = LinesChart;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [], function () { return LinesChart; } );
    }

})();