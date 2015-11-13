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
                default: '¬_E.resource¬'
            },
            yAxisTicks: {
                type: 'number',
                default: 5
            },
            total: {
                type: 'object',
                default: null
            },
            maxDecimals: {
                type: 'number',
                default: 2
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
        this.aproximatedDates = false;

        // Extending widget
        framework.widgets.CommonWidget.call(this, false, this.element.get(0));

        // Configuration
        this.configuration = normalizeConfig(configuration);

        this.element.append('<svg class="blurable"></svg>');
        this.svg = this.element.children("svg");
        this.svg.get(0).style.minHeight = this.configuration.height + "px";

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

    /**
     * Gets a normalized array of data according to the chart expected input from the data returned by the framework.
     * @param framework_data
     * @returns {Array} Contains objects with 'label' and 'value'.
     */
    var getNormalizedData = function getNormalizedData(framework_data) {

        var values = [];
        var totalDataRef;
        for(var resourceName in framework_data) {

            for(var resId in framework_data[resourceName]){

                var metric = framework_data[resourceName][resId];
                var metricData = metric['data'];

                if(metric['info']['request']['params']['max'] > 0) {
                    this.aproximatedDates = true;
                }

                //Generate the label by replacing the variables
                var label = this.replace(this.configuration.labelFormat, metric, {resource: resourceName, resourceId:  resId});

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

                if(this.configuration.total != null && resourceName == this.configuration.total.id) {
                    totalDataRef = mData;
                }

                values.push(mData);


            }
        }

        // If total is used, then we have to calculate the difference in respect of the values displayed
        if(totalDataRef != null) {

            //Calculate the total all the values shown
            for(var v = 0; v < totalDataRef['values'].length; ++v) {

                var total = totalDataRef['values'][v]['y'];

                // The sum f the displayed values
                var shownSum = 0;
                for(var d = 0; d < values.length; ++d) {
                    if(values[d] != totalDataRef) {
                        shownSum += values[d]['values'][v]['y'];
                    }
                }

                //Override the value with the difference between the total and the sum of the shown
                totalDataRef['values'][v]['y'] = total - shownSum;
                if(totalDataRef['values'][v]['y'] < 0 ) {
                    totalDataRef['values'][v]['y'] = 20; //TODO: temporal while still have made up values
                }

            }

            totalDataRef.key = "Others";

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

            if(this.aproximatedDates) {
                chart.tooltip.headerFormatter(function(d) {
                    return '~' + this.format.date(d);
                }.bind(this));
            }

            chart.xAxis.tickFormat(function(d) {
                return this.format.date(d);
            }.bind(this))
                .showMaxMin(false);

            chart.yAxis.tickFormat(function(d) {

                //Truncate decimals
                if(this.configuration.maxDecimals >= 0) {
                    var pow =  Math.pow(10, this.configuration.maxDecimals);
                    d = Math.floor(d * pow) / pow;
                }

                if (d >= 1000 || d <= -1000) {
                    return Math.abs(d/1000) + " K";
                } else {
                    return Math.abs(d);
                }
            }.bind(this)).showMaxMin(true).ticks(this.configuration.yAxisTicks - 1);

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
