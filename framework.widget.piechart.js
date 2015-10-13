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
        donut: {
            type: ['boolean'],
            default: false
        },
        growOnHover: {
            type: ['boolean'],
            default: false
        },
        cornerRadius: {
            type: ['number'],
            default: 4
        },
        padAngle: {
            type: ['number'],
            default: 0.05
        },
        showLegend: {
            type: ['boolean'],
            default: true
        },
        showLabels: {
            type: ['boolean'],
            default: true
        },
        donutRatio: {
            type: ['number'],
            default: 0.5
        },
        duration: {
            type: ['number'],
            default: 250
        },
        labelFormat: {
            type: ['string'],
            default: "%resourceId%"
        },
        labelsOutside: {
            type: ['boolean'],
            default: true
        },
        maxDecimals: {
            type: ['number'],
            default: 2
        }
    };

    /* PieChart constructor
     *   element: the DOM element that will contain the PieChart
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
    var PieChart = function PieChart(element, metrics, contextId, configuration) {

        if(!framework.isReady()) {
            console.error("PieChart object could not be created because framework is not loaded.");
            return;
        }

        // CHECK D3
        if(typeof d3 === 'undefined') {
            console.error("PieChart could not be loaded because d3 did not exist.");
            return;
        }

        // CHECK NVD3
        if(typeof nv === 'undefined') {
            console.error("PieChart could not be loaded because nvd3 did not exist.");
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

        this.observeCallback = this.commonObserveCallback.bind(this);

        framework.data.observe(metrics, this.observeCallback , contextId);

    };

    PieChart.prototype = new framework.widgets.CommonWidget(true);

    PieChart.prototype.updateData = function(framework_data) {

        var normalizedData = getNormalizedData.call(this,framework_data);

        //Update data
        if(this.svg != null) {
            d3.select(this.svg.get(0)).datum(normalizedData);
            this.chart.color(this.generateColors(framework_data));
            this.chart.update();

        } else { // Paint it for first time
            paint.call(this, normalizedData, framework_data);
        }

    };

    PieChart.prototype.delete = function() {

        //Stop observing for data changes
        framework.data.stopObserve(this.observeCallback);

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
                var metricData = framework_data[metricId][m]['data'];

                //Create a replacer for this metric
                var metricReplacer = replacer.bind(null, metricId, metric);

                //Generate the label by replacing the variables
                var label = this.configuration.labelFormat.replace(labelVariable,metricReplacer);

                for(var i in metricData['values']) {

                    values.push({
                        label: label,
                        value: metricData['values'][i]
                    });
                }
            }
        }

        return values;

    };

    var paint = function paint(data, framework_data) {

        this.element.append('<svg class="blurable"></svg>');
        this.svg = this.element.children("svg");
        this.svg.get(0).style.minHeight = this.configuration.height + "px";

        nv.addGraph({
            generate: function() {

                this.chart = nv.models.pieChart()
                    .x(function(d) {
                        return d.label;
                    })
                    .y(function(d) {

                        //Truncate decimals
                        if(this.configuration.maxDecimals >= 0) {
                            var pow =  Math.pow(10, this.configuration.maxDecimals);
                            d.value = Math.floor(d.value * pow) / pow;
                        }

                        return d.value;
                    }.bind(this))
                    .donut(this.configuration.donut)
                    .height(this.configuration.height)
                    .padAngle(this.configuration.padAngle)
                    .cornerRadius(this.configuration.cornerRadius)
                    .growOnHover(this.configuration.growOnHover)
                    .showLegend(this.configuration.showLegend)
                    .showLabels(this.configuration.showLabels)
                    .donutRatio(this.configuration.donutRatio)
                    .duration(this.configuration.duration)
                    .labelsOutside(this.configuration.labelsOutside)
                    .color(this.generateColors(framework_data));

                d3.select(this.svg.get(0))
                    .datum(data) //TODO
                    .transition().duration(0)
                    .call(this.chart);

                nv.utils.windowResize(this.chart.update);

                return this.chart;

            }.bind(this)
        });

    };

    window.framework.widgets.PieChart = PieChart;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [], function () { return PieChart; } );
    }

})();