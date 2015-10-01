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

    var defaultConfig = {
        height: {
            type: ['number'],
            default: 240
        },
        color: {
            type: ['function'],
            default: null
        },
        size: {
            type: ['function'],
            default: null
        },
        shape: {
            type: ['function'],
            default: null
        },
        x: {
            type: ['function'],
            default: null
        },
        showXAxis: {
            type: ['boolean'],
            default: true
        },
        xAxisLabel: {
            type: ['string'],
            default: null
        },
        xAxisTicks: {
            type: ['number'],
            default: 2
        },
        xAxisFormat: {
            type: ['function'],
            default: d3.format('.03f')
        },
        y: {
            type: ['function'],
            default: null
        },
        showYAxis: {
            type: ['boolean'],
            default: true
        },
        yAxisLabel: {
            type: ['string'],
            default: null
        },
        yAxisTicks: {
            type: ['number'],
            default: 2
        },
        yAxisFormat: {
            type: ['function'],
            default: d3.format('.03f')
        },
        groupBy: {
            type: ['string'],
            default: null
        },
        showLegend: {
            type: ['boolean'],
            default: true
        },
        showDistX: {
            type: ['boolean'],
            default: false
        },
        showDistY: {
            type: ['boolean'],
            default: false
        },
        labelFormat: {
            type: ['string'],
            default: ''
        },
        xDomain: {
            type: [Array],
            default: null //Dynamically calculated
        },
        yDomain: {
            type: [Array],
            default: null //Dynamically calculated
        },
        pointDomain: {
            type: [Array],
            default: null //Dynamically calculated
        },
        clipEdge: {
            type: ['boolean'],
            default: false
        },
        tooltip: {
            type: ['string', 'function'],
            default: null
        }

    };

    /* Scatter constructor
     *   element: the DOM element that will contain the rangeNv
     *   data: the data id array
     *   contextId: optional.
     *   configuration: additional chart configuration:
     *      {
     *       ~ height: number - Height of the widget.
     *       ~ color: function - Function to decide the color of the point.
     *       ~ size: function - Function to decide the size of the point.
     *       ~ shape: function - Function to decide the shape of the point. Can be: circle, cross, diamond, square,
     *          triangle-down, triangle-dup.
     *       ~ x: function - Function to decide the value of the point in the x axis.
     *       ~ y: function - Function to decide the value of the point in the y axis.
     *       ~ groupBy: string - Name of the parameter used to group the requested metrics. For example, 'pid'.
     *       ~ showLegend: boolean - Whether to display the legend or not.
     *       ~ showXAxis: boolean - Display or hide the X axis.
     *       ~ showYAxis: boolean - Display or hide the Y axis.
     *       ~ xAxisLabel: string - Label to display in the x axis.
     *       ~ yAxisLabel: string - Label to display in the y axis.
     *       ~ xAxisTicks: number - Number of ticks of the x axis.
     *       ~ yAxisTicks: number - Number of ticks of the y axis.
     *       ~ xAxisFormat: function - D3 format for the x axis.
     *       ~ yAxisFormat: function - D3 format for the y axis.
     *       ~ labelFormat: string - Format string for the labels. Metric parameters can be used as variables by
     *         surrounding their names with the symbol '¬'. Metrics data can be accessed with _D. For example,
     *         the following is a valid labelFormat: "Repository: ¬_D.repocommits.info.rid.name¬".
     *       ~ TODO: complete documentation
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
        this.configuration = this.normalizeConfig(defaultConfig, configuration);

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
                        x: this.configuration.x(metricsGroup),
                        y: this.configuration.y(metricsGroup),
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
            this.chart.xAxis
                .axisLabel(this.configuration.xAxisLabel)
                .tickFormat(this.configuration.xAxisFormat)
                .ticks(this.configuration.xAxisTicks);
            this.chart.yAxis
                .axisLabel(this.configuration.yAxisLabel)
                .tickFormat(this.configuration.yAxisFormat)
                .ticks(this.configuration.yAxisTicks);


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