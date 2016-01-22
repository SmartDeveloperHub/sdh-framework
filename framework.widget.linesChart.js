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
            configuration.labelFormat = '¬_E.resource¬';
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
        if (typeof configuration.maxDecimals != "number") {
            configuration.maxDecimals = 2;
        }
        if (typeof configuration.showPoints != "boolean") {
            configuration.showPoints = false;
        }
        if (typeof configuration.showLines != "boolean") {
            configuration.showLines = true;
        }
        // Demo
        if (typeof configuration._demo != "boolean") {
            configuration._demo = false;
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
     *       ~ showPoints: boolean - Whether to display points or not. Default:false
     *       ~ showLines: boolean - Whether to display lines or not. Default:true
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

        this.element = $(element); //Store as jquery object
        this.data = null;
        this.chart = null;
        this.labels = {};
        this.aproximatedDates = false;
        this.status = 0; // 0 - not initialized, 1 - ready, 2 - destroyed

        // Extending widget
        framework.widgets.CommonWidget.call(this, false, this.element.get(0));

        // Configuration
        this.configuration = normalizeConfig(configuration);

        this.observeCallback = this.commonObserveCallback.bind(this);

        framework.data.observe(metrics, this.observeCallback , contextId);
    };

    LinesChart.prototype = new framework.widgets.CommonWidget(true);

    LinesChart.prototype.updateData = function(framework_data) {

        // Has been destroyed
        if(this.status === 2)
            return;

        var normalizedData = getNormalizedData.call(this,framework_data);

        //Update data
        if(this.status === 1) {
            d3.select(this.svg.get(0)).datum(normalizedData);
            this.chart.color(this.generateColors(framework_data, this.configuration.colors));
            this.updateChart();

        } else if(this.status === 0) { // Paint it for first time
            paint.call(this, normalizedData, framework_data);
        }

    };

    LinesChart.prototype.delete = function() {

        // Has already been destroyed
        if(this.status === 2)
            return;

        //Stop observing for data changes
        framework.data.stopObserve(this.observeCallback);

        //Remove resize event listener and empty initialized elements
        if(this.status === 1) {
            $(window).off("resize", this.updateChart);

            this.svg.empty();
            this.chart = null;
        }

        //Clear DOM
        this.element.empty();

        this.svg = null;

        //Update status
        this.status = 2;

    };


    // PRIVATE METHODS - - - - - - - - - - - - - - - - - - - - - -

    /**
     * Gets a normalized array of data according to the chart expected input from the data returned by the framework.
     * @param framework_data
     * @returns {Array} Contains objects with 'label' and 'value'.
     */
    var getNormalizedData = function getNormalizedData(framework_data) {

        var series = [];
        this.labels = {};
        //var colors = ['#ff7f0e','#2ca02c','#7777ff','#D53E4F','#9E0142'];
        //Data is represented as an array of {x,y} pairs.
        for (var resourceName in framework_data) {
            for (var resId in framework_data[resourceName]) {

                var metric = framework_data[resourceName][resId];
                var metricData = framework_data[resourceName][resId]['data'];

                if(metric['info']['request']['params']['max'] > 0) {
                    this.aproximatedDates = true;
                }

                var yserie = metricData.values;

                var genLabel = function genLabel(i) {

                    var lab = this.replace(this.configuration.labelFormat, metric, {resource: resourceName, resourceId:  resId});

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
                    label = "Commits";
                    if (metric.info.request.params.aggr == "avg") {
                        label = "Average commits";
                    }
                } else {
                    // Generate the label by replacing the variables
                    label = genLabel.call(this, 0);
                }

                // Metric dataset
                var dat = yserie.map(function(dat, index) {

                    //We need to distribute the time of the step among all the "segments" of data so that the first
                    // value's date corresponds to the "from" date of the interval and the last value's date corresponds
                    // to the "to" date of the interval minus 1 second.
                    var distributedStep = index * (metricData.step - 1) / (metricData.values.length - 1);

                    return {'x': new Date(metricData.interval.from + index * metricData.step + distributedStep), 'y': dat};
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

        var extraClass = '';
        if (this.configuration.showPoints && this.configuration.showLines) {
            extraClass = "showPoints";
        }
        if(!this.configuration.showLines && !this.configuration.showPoints) {
            extraClass = "hideLines"
        }
        if(!this.configuration.showLines && this.configuration.showPoints) {
            extraClass = "hideLines showPoints"
        }

        this.element.append('<svg class="lineChart blurable ' + extraClass + '"></svg>');
        this.svg = this.element.children("svg");

        nv.addGraph(function() {

            if(this.status != 0) {
                return; //Already initialized or destroyed
            }

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
            if(this.aproximatedDates) {
                chart.interactiveLayer.tooltip.headerFormatter(function(d) {
                    return '~' + d;
                });
            }

            chart.xAxis     //Chart x-axis settings
                .axisLabel(this.configuration.xlabel)
                .tickFormat(function(d) {
                    return this.format.date(new Date(d));
                }.bind(this));

            chart.yAxis     //Chart y-axis settings
                .axisLabel(this.configuration.ylabel)
                .tickFormat(function(tickVal) {

                    //Truncate decimals
                    if(this.configuration.maxDecimals >= 0) {
                        var pow =  Math.pow(10, this.configuration.maxDecimals);
                        tickVal = Math.floor(tickVal * pow) / pow;
                    }

                    if (tickVal >= 1000 || tickVal <= -1000) {
                        return tickVal/1000 + " K";
                    } else {
                        return tickVal;
                    }
                }.bind(this));


            d3.select(this.svg.get(0))   //Select the <svg> element you want to render the chart in.
                .datum(data)          //Populate the <svg> elemen
                .call(chart);         //Finally, render the chart!

            //Update the chart when window resizes.
            this.updateChart = this.chart.update; //This is important to get the reference because it changes!
            $(window).resize(this.updateChart);

            // Set the chart as ready
            this.status = 1;

          return chart;
        }.bind(this));

    };

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [
            'widgetCommon',
            'd3',
            'css!vendor/sdh-framework/framework.widget.linesChart.css'
        ], function () {
            window.framework.widgets.LinesChart = LinesChart;
            return LinesChart;
        } );
    } else {
        window.framework.widgets.LinesChart = LinesChart;
    }

})();