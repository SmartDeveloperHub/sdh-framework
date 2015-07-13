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

    /**
     *
     * @param configuration
     * @returns {*}
     */
    var normalizeConfig = function normalizeConfig(configuration) {
        if (configuration == null) {
            configuration = {};
        }

        var defaultConfig = {
            height: {
                type: 'number',
                default: 240
            },
            color: {
                type: 'object',
                default: null
            },
            stacked: {
                type: 'boolean',
                default: false
            },
            groupSpacing: {
                type: 'number',
                default: 0.1
            },
            duration: {
                type: 'number',
                default: 250
            },
            showControls: {
                type: 'boolean',
                default: true
            },
            showLegend: {
                type: 'boolean',
                default: true
            },
            showXAxis: {
                type: 'boolean',
                default: true
            },
            showYAxis: {
                type: 'boolean',
                default: true
            },
            labelFormat: {
                type: 'string',
                default: '%mid%'
            },
            yAxisTicks: {
                type: 'number',
                default: 5
            },
            total: {
                type: 'object',
                default: null
            }

        };

        for(var confName in defaultConfig) {
            var conf = defaultConfig[confName];
            if (typeof configuration[confName] != conf['type']) {
                configuration[confName] = conf['default'];
            }
        }

        return configuration;
    };

    /* rangeNv constructor
     *   element: the DOM element that will contain the rangeNv
     *   data: the data id array
     *   contextId: optional.
     *   configuration: additional chart configuration:
     *      {
     *       ~ height: number - Height of the widget.
     *       ~ color: array - Array of colors to use for the different data.
     *              Example:
     *                  chart.color(["#FF0000","#00FF00","#0000FF"])
     *       ~ stacked: boolean - Whether to display the different data stacked or not.
     *       ~ groupSpacing: number - The padding between bar groups.
     *       ~ duration: number - Duration in ms to take when updating chart. For things like bar charts, each bar can
     *         animate by itself but the total time taken should be this value.
     *       ~ showControls: boolean - Whether to show extra controls or not. Extra controls include things like making
     *         HorizontalBar charts stacked or side by side.
     *       ~ showLegend: boolean - Whether to display the legend or not.
     *       ~ showXAxis: boolean - Display or hide the X axis.
     *       ~ showYAxis: boolean - Display or hide the Y axis.
     *       ~ labelFormat: string - Format string for the labels. Metric parameters can be used as variables by
     *         surrounding their names with percentages. The metric name can also be accessed with %mid%. For example,
     *         the following is a valid labelFormat: "User: %uid%".
     *       ~ yAxisTicks: number - Number of ticks of the Y axis.
     *       ~ total: object - Metric object to use as the total of the horizontal bar. I will make appear another
     *         segment called 'Others' with the difference between the total value and the sum of the displayed segments.
     *      }
     */
    var HorizontalBar = function HorizontalBar(element, metrics, contextId, configuration) {

        if(!framework.isReady()) {
            console.error("HorizontalBar object could not be created because framework is not loaded.");
            return;
        }

        // CHECK D3
        if(typeof d3 === 'undefined') {
            console.error("HorizontalBar could not be loaded because d3 did not exist.");
            return;
        }

        // CHECK NVD3
        if(typeof nv === 'undefined') {
            console.error("HorizontalBar could not be loaded because nvd3 did not exist.");
            return;
        }

        // We need relative position for the nvd3 tooltips
        element.style.position = 'inherit';

        this.element = $(element); //Store as jquery object
        this.data = null;
        this.chart = null;

        // Extending widget
        framework.widgets.CommonWidget.call(this, false, this.element.get(0));

        // Configuration
        this.configuration = normalizeConfig(configuration);

        this.element.append('<svg class="blurable"></svg>');
        this.svg = this.element.children("svg");
        this.svg.get(0).style.minHeight = configuration.height;

        if(this.configuration.total != null) {
            metrics.push(this.configuration.total);
        }

        this.observeCallback = this.commonObserveCallback.bind(this);

        framework.data.observe(metrics, this.observeCallback , contextId);

    };

    HorizontalBar.prototype = new framework.widgets.CommonWidget(true);

    HorizontalBar.prototype.updateData = function(framework_data) {

        var normalizedData = getNormalizedData.call(this,framework_data);

        //Update data
        if(this.chart != null) {
            d3.select(this.svg.get(0)).datum(normalizedData);
            this.chart.color(this.generateColors(framework_data, this.configuration.color));
            this.chart.update();

        } else { // Paint it for first time
            paint.call(this, normalizedData, framework_data);
        }

    };

    HorizontalBar.prototype.delete = function() {

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

        var values = [];
        var labelVariable = /%(\w|\.)+%/g; //Regex that matches all the "variables" of the label such as %mid%, %pid%...

        for(var metricId in framework_data) {

            for(var m in framework_data[metricId]){

                var metric = framework_data[metricId][m];
                var metricData = metric['data'];

                //Create a replacer for this metric
                var metricReplacer = replacer.bind(null, metricId, metric);

                //Generate the label by replacing the variables
                var label = this.configuration.labelFormat.replace(labelVariable,metricReplacer);

                //Get this metric date extent
                var dateExtent = [new Date(metricData['interval']['from']), new Date(metricData['interval']['to'])];

                var mData = {
                    key: label,
                    values: []
                };

                for(var i = 0, len = metricData['values'].length; i < len; ++i) {

                    var curDate = dateExtent[0].getTime() + i * metricData['step'];

                    mData.values.push({
                        x: curDate,
                        y: metricData['values'][i]
                    });

                }

                values.push(mData);


            }
        }

        // If total is used, then we have to make some arrangements with the last value
        if(this.configuration.total != null) {
            var totalData = values.pop();

            //Calculate the total all the values shown
            for(var v = 0; v < totalData['values'].length; ++v) {

                var total = totalData['values'][v]['y'];

                // The sum f the displayed values
                var shownSum = 0;
                for(var d = 0; d < values.length; ++d) {
                    shownSum += values[d]['values'][v]['y'];
                }

                //Override the value with the difference between the total and the sum of the shown
                totalData['values'][v]['y'] = total - shownSum;
                if(totalData['values'][v]['y'] < 0 ) {
                    totalData['values'][v]['y'] = 20; //TODO: temporal while still have made up values
                }

            }

            totalData.key = "Others";

            //Now add it again
            values.push(totalData);
        }

        return values;

    };

    var paint = function paint(data, framework_data) {

        nv.addGraph(function() {
            var chart = nv.models.multiBarHorizontalChart()
                .x(function(d) { return d.x; })
                .y(function(d) { return d.y; })
                .height(this.configuration.height)
                .color(this.generateColors(framework_data, this.configuration.color))
                .stacked(this.configuration.stacked)
                .groupSpacing(this.configuration.groupSpacing)
                .duration(this.configuration.duration)
                .showControls(this.configuration.showControls)
                .showLegend(this.configuration.showLegend)
                .showXAxis(this.configuration.showXAxis)
                .showYAxis(this.configuration.showYAxis);
            this.chart = chart;

            chart.xAxis.tickFormat(function(d) {
                return d3.time.format('%x')(new Date(d));
                })
                .showMaxMin(false);

            chart.yAxis.tickFormat(function(d) {
                if (d >= 1000 || d <= -1000) {
                    return Math.abs(d/1000) + " K";
                } else {
                    return Math.abs(d);
                }
            }).showMaxMin(true).ticks(this.configuration.yAxisTicks - 1);

            d3.select(this.svg.get(0))
                .datum(data)
                .call(chart);


            //Update the chart when window resizes.
            this.resizeEventHandler = function() { chart.update() };
            $(window).resize(this.resizeEventHandler);

            return chart;
        }.bind(this));

    };

    window.framework.widgets.HorizontalBar = HorizontalBar;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [], function () { return HorizontalBar; } );
    }

})();
