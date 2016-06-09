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

    var __loader = (function() {

        var defaultConfig = {
            height: {
                type: ['number'],
                default: 240
            },
            color: {
                type: ['object'],
                default: null
            },
            stacked: {
                type: ['boolean'],
                default: false
            },
            groupSpacing: {
                type: ['number'],
                default: 0.1
            },
            duration: {
                type: ['number'],
                default: 250
            },
            showControls: {
                type: ['boolean'],
                default: true
            },
            showLegend: {
                type: ['boolean'],
                default: true
            },
            showXAxis: {
                type: ['boolean'],
                default: true
            },
            showYAxis: {
                type: ['boolean'],
                default: true
            },
            labelFormat: {
                type: ['string'],
                default: '¬_E.resource¬'
            },
            maxDecimals: {
                type: ['number'],
                default: 2
            },
            xAxisTickFormat: {
                type: ['function'],
                default: null
            },
            yAxisTickFormat: {
                type: ['function'],
                default: null
            },
            x: {
                type: ['function'],
                default: function(metric, extra) {
                    //Get this metric date extent
                    var dateExtent = [new Date(metric['data']['interval']['from']), new Date(metric['data']['interval']['to'])];
                    return dateExtent[0].getTime() + extra.valueIndex * metric['data']['step'];
                }
            }
        };

        /* rangeNv constructor
         *   element: the DOM element that will contain the rangeNv
         *   data: the data id array
         *   contextId: optional.
         *   configuration: additional chart configuration:
         *      {
         *       ~ height: number - Height of the widget.
         *       ~ color: array - Array of colors to use for the different data
         *              Example:
         *                  chart.color(["#FF0000","#00FF00","#0000FF"])
         *       ~ stacked: boolean - Whether to display the different data stacked or not.
         *       ~ groupSpacing: number - The padding between bar groups.
         *       ~ duration: number - Duration in ms to take when updating chart. For things like bar charts, each bar can
         *         animate by itself but the total time taken should be this value.
         *       ~ showControls: boolean - Whether to show extra controls or not. Extra controls include things like making
         *         MultiBar charts stacked or side by side.
         *       ~ showLegend: boolean - Whether to display the legend or not.
         *       ~ showXAxis: boolean - Display or hide the X axis.
         *       ~ showYAxis: boolean - Display or hide the Y axis.
         *       ~ labelFormat: string - Format string for the labels. Metric parameters can be used as variables by
         *         surrounding their names with percentages. The metric name can also be accessed with %mid%. For example,
         *         the following is a valid labelFormat: "User: %uid%".
         *      }
         */
        var MultiBar = function MultiBar(element, metrics, contextId, configuration) {

            if(!framework.isReady()) {
                console.error("MultiBar object could not be created because framework is not loaded.");
                return;
            }

            // CHECK D3
            if(typeof d3 === 'undefined') {
                console.error("MultiBar could not be loaded because d3 did not exist.");
                return;
            }

            // CHECK NVD3
            if(typeof nv === 'undefined') {
                console.error("MultiBar could not be loaded because nvd3 did not exist.");
                return;
            }

            // We need relative position for the nvd3 tooltips
            element.style.position = 'inherit';

            this.element = $(element); //Store as jquery object
            this.data = null;
            this.chart = null;
            this.aproximatedDates = false;
            this.status = 0; // 0 - not initialized, 1 - ready, 2 - destroyed

            // Extending widget
            framework.widgets.CommonWidget.call(this, false, this.element.get(0));

            // Configuration
            this.configuration = this.normalizeConfig(defaultConfig, configuration);

            this.element.append('<svg class="blurable"></svg>');
            this.svg = this.element.children("svg");
            this.svg.get(0).style.minHeight = this.configuration.height + "px";

            this.observeCallback = this.commonObserveCallback.bind(this);

            framework.data.observe(metrics, this.observeCallback , contextId);

        };

        MultiBar.prototype = new framework.widgets.CommonWidget(true);

        MultiBar.prototype.updateData = function(framework_data) {

            // Has been destroyed
            if(this.status === 2)
                return;

            var normalizedData = getNormalizedData.call(this,framework_data);

            //Update data
            if(this.status === 1) {
                d3.select(this.svg.get(0)).datum(normalizedData);
                this.chart.color(this.generateColors(framework_data, this.configuration.color));
                this.updateChart();

            } else { // Paint it for first time
                paint.call(this, normalizedData, framework_data);
            }

        };

        MultiBar.prototype.delete = function() {

            // Has already been destroyed
            if(this.status === 2)
                return;

            //Stop observing for data changes
            framework.data.stopObserve(this.observeCallback);

            //Remove resize event listener
            if(this.status === 1) {
                $(window).off("resize", this.updateChart);
                this.chart = null;
            }

            //Clear DOM
            this.svg.empty();
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

            var values = [];

            for(var resourceName in framework_data) {

                for(var resId in framework_data[resourceName]){

                    var metric = framework_data[resourceName][resId];
                    var metricData = framework_data[resourceName][resId]['data'];

                    if(metric['info']['request']['params']['max'] > 0) {
                        this.aproximatedDates = true;
                    }

                    //Generate the label by replacing the variables
                    var label = this.replace(this.configuration.labelFormat, metric, {resource: resourceName, resourceId:  resId});

                    var mData = null;
                    var newDataGroup = true;
                    for(var i = 0; i < values.length; i++) {
                        if(values[i].key === label) {
                            mData = values[i];
                            newDataGroup = false;
                            break;
                        }
                    }

                    if(newDataGroup) {
                        mData = {
                            key: label,
                            values: []
                        };
                    }

                    for(var i = 0, len = metricData['values'].length; i < len; ++i) {

                        var xValue;

                        if(typeof this.configuration.x === 'function') {
                            xValue = this.configuration.x(metric, {resource: resourceName, resourceId:  resId, valueIndex: i});
                        } else {
                            xValue = this.replace(this.configuration.x, metric, {resource: resourceName, resourceId:  resId, valueIndex: i});
                        }


                        mData.values.push({
                            x: xValue,
                            y: metricData['values'][i]
                        });

                    }

                    if(newDataGroup) {
                        values.push(mData);
                    }


                }
            }

            return values;

        };

        var paint = function paint(data, framework_data) {

            nv.addGraph(function() {

                if(this.status != 0) {
                    return; //Already initialized or destroyed
                }

                var chart = nv.models.multiBarChart()
                    .height(this.configuration.height)
                    .color(this.generateColors(framework_data, this.configuration.color))
                    .stacked(this.configuration.stacked)
                    .groupSpacing(this.configuration.groupSpacing)
                    .duration(this.configuration.duration)
                    .showControls(this.configuration.showControls)
                    .showLegend(this.configuration.showLegend)
                    .showXAxis(this.configuration.showXAxis)
                    .showYAxis(this.configuration.showYAxis) ;
                this.chart = chart;

                if(this.aproximatedDates) {
                    chart.tooltip.headerFormatter(function(d) {
                        if(typeof d === 'string') {
                            return d;
                        } else {
                            return '~' + this.format.date(d);
                        }
                    }.bind(this));
                }

                if(this.configuration.xAxisTickFormat) {
                    chart.xAxis.tickFormat(this.configuration.xAxisTickFormat.bind(this));
                } else {
                    chart.xAxis.tickFormat(function(d) {
                        if (typeof d === 'string') {
                            return d;
                        } else {
                            return this.format.date(new Date(d));
                        }
                    }.bind(this));
                }

                chart.xAxis.showMaxMin(false);

                if(this.configuration.yAxisTickFormat) {
                    chart.yAxis.tickFormat(this.configuration.yAxisTickFormat.bind(this));
                } else {
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
                    }.bind(this));
                }


                d3.select(this.svg.get(0))
                    .datum(data)
                    .call(chart);

                //Update the chart when window resizes.
                this.updateChart = this.chart.update; //This is important to get the reference because it changes!
                $(window).resize(this.updateChart);

                // Set the chart as ready
                this.status = 1;

                return chart;
            }.bind(this));

        };

        window.framework.widgets.MultiBar = MultiBar;
        return MultiBar;

    });

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [
            'sdh-framework/widgets/Common/common',
            'nvd3'
        ], function () {
            return __loader();
        } );
    } else {
        __loader();
    }

})();