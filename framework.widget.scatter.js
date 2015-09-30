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

        var defaultConfig = {
            height: {
                type: 'number',
                default: 240
            },
            color: {
                type: 'function',
                default: null
            },
            size: {
                type: 'function',
                default: null
            },
            shape: {
                type: 'function',
                default: null
            },
            xAxis: {
                type: 'function',
                default: null
            },
            xAxisLabel: {
                type: 'string',
                default: null
            },
            yAxis: {
                type: 'function',
                default: null
            },
            yAxisLabel: {
                type: 'string',
                default: null
            },
            groupBy: { //TODO: sobre que arupar las metricas (pid)
                type: 'string',
                default: null
            },
            showXAxis: {
                type: 'boolean',
                default: true
            },
            showYAxis: {
                type: 'boolean',
                default: true
            },
            showLegend: {
                type: 'boolean',
                default: true
            },
            showDistX: {
                type: 'boolean',
                default: false
            },
            showDistY: {
                type: 'boolean',
                default: false
            },
            labelFormat: {
                type: 'string',
                default: '%mid%'
            },
            xDomain: {
                type: 'object',
                default: null //Dynamically calculated
            },
            yDomain: {
                type: 'object',
                default: null //Dynamically calculated
            },
            pointDomain: {
                type: 'object',
                default: null //Dynamically calculated
            },
            clipEdge: {
                type: 'boolean',
                default: false
            },
            tooltip: {
                type: 'string|function',
                default: null
            }

        };

        for(var confName in defaultConfig) {
            var conf = defaultConfig[confName];
            if (conf['type'].split('|').indexOf(typeof configuration[confName]) === -1) {
                configuration[confName] = conf['default'];
            }
        }

        return configuration;


    };

    /* Scatter constructor
     *   element: the DOM element that will contain the Scatter
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
     *       ~ labelsOutside: boolean - Whether pie/donut chart labels should be outside the slices instead of inside them.
     *      }
     */
    var Scatter = function Scatter(element, metrics, contextId, configuration) {

        if(!framework.isReady()) {
            console.error("Scatter object could not be created because framework is not loaded.");
            return;
        }

        // CHECK D3
        if(typeof d3 === 'undefined') {
            console.error("Scatter could not be loaded because d3 did not exist.");
            return;
        }

        // CHECK NVD3
        if(typeof nv === 'undefined') {
            console.error("Scatter could not be loaded because nvd3 did not exist.");
            return;
        }

        this.element = $(element); //Store as jquery object
        this.svg = null;
        this.data = null;
        this.chart = null;

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

    Scatter.prototype = new framework.widgets.CommonWidget(true);

    Scatter.prototype.updateData = function(framework_data) {

        var normalizedData = getNormalizedData.call(this,framework_data);

        //Update data
        if(this.chart != null) {
            d3.select(this.svg.get(0)).datum(normalizedData);
            this.chart.update();

        } else { // Paint it for first time
            console.log(normalizedData);
            paint.call(this, normalizedData, framework_data);
        }

    };

    Scatter.prototype.delete = function() {

        //Stop observing for data changes
        framework.data.stopObserve(this.observeCallback);

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

        var data = [];
        var result = [];
        var labelVariable = /%(\w|\.)+%/g; //Regex that matches all the "variables" of the label such as %mid%, %pid%...

        // Group metric values by a request param
        for(var resourceId in framework_data) {

            for(var r in framework_data[resourceId]){

                var resource = framework_data[resourceId][r];
                var resourceData = framework_data[resourceId][r]['data'];

                //TOOD: groupBy not defined??
                var group = resource['info']['request']['params'][this.configuration.groupBy];

                if(data[group] == null) {
                    data[group] = {};
                }

                data[group][resourceId] = resourceData;

            }
        }

        // Iterate over the groups to generate the structure required by the chart
        for(var i in data) {
            var metricsGroup = data[i];

            //Generate the label by replacing the variables
            var label = this.replace(this.configuration.labelFormat, metricsGroup);

            var groupEntry = {
                key: label,
                color: this.configuration.color(metricsGroup),
                values: [
                    {
                        size: this.configuration.size(metricsGroup),
                        shape: this.configuration.shape(metricsGroup),
                        x: this.configuration.xAxis(metricsGroup),
                        y: this.configuration.yAxis(metricsGroup),
                        data: metricsGroup
                    }
                ]
            };

            result.push(groupEntry);

        }

        return result;

    };

    var paint = function paint(data, framework_data) {

        nv.addGraph(function() {

            this.chart = nv.models.scatterChart()
                .showDistX(this.configuration.showDistX)    //showDist, when true, will display those little distribution lines on the axis.
                .showDistY(this.configuration.showDistY)
                .duration(300)
                .height(this.configuration.height)
                .pointDomain(this.configuration.pointDomain)
                .useVoronoi(true)
                .color(function(d) {
                    return d.color;
                })
                .xDomain(this.configuration.xDomain)
                .yDomain(this.configuration.yDomain)
                .clipEdge(this.configuration.clipEdge);

            //Configure how the tooltip looks.
            if(typeof this.configuration.tooltip === 'string') {

                this.chart.tooltip.contentGenerator(function(pointData) {
                    return this.replace(this.configuration.tooltip, pointData);
                }.bind(this));

            } else if(typeof this.configuration.tooltip === 'function') {
                this.chart.tooltip.contentGenerator(this.configuration.tooltip);
            }


            //Axis settings
            this.chart.xAxis.axisLabel(this.configuration.xAxisLabel).tickFormat(d3.format('.03f')).ticks(2);
            this.chart.yAxis.axisLabel(this.configuration.yAxisLabel).tickFormat(d3.format('.03f')).ticks(2);

            //We want to show shapes other than circles.
            //this.chart.scatter.onlyCircles(false);

            d3.select(this.svg.get(0))
                .datum(data)
                .call(this.chart);

            nv.utils.windowResize(this.chart.update);

            return this.chart;
        }.bind(this));


    };

    window.framework.widgets.Scatter = Scatter;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [], function () { return Scatter; } );
    }

})();