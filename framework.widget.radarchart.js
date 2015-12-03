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
    var defaultConfig = {
        height: {
            type: ['number'],
            default: 240
        },
        radius: {
            type: ['number'],
            default: 200
        },
        labels: {
            type: [Array],
            default: []
        },
        labelsAssoc: {
            type: [Array],
            default: ""
        },
        fillColor: {
            type: ['string', Array],
            default: 'rgba(22,22,220,0.2)'
        },
        strokeColor: {
            type: ['string', Array],
            default: 'rgba(22,22,220,0.5)'
        },
        pointColor: {
            type: ['string', Array],
            default: 'rgba(22,22,220,0.75)'
        },
        pointDot: {
            type: ['boolean'],
            default: true
        },
        pointDotRadius: {
            type: ['number'],
            default: 3
        },
        pointDotStrokeWidth: {
            type: ['number'],
            default: 1
        },
        pointLabelFontSize: {
            type: ['number'],
            default: 12
        },
        pointLabelFontColor: {
            type: ['string'],
            default: '#666'
        },
        pointStrokeColor: {
            type: ['string', Array],
            default: "#fff"
        },
        pointHighlightFill: {
            type: ['string', Array],
            default: "#fff"
        },
        pointHighlightStroke: {
            type: ['string', Array],
            default: "rgba(22,22,220,1)"
        },
        maxDecimals: {
            type: ['number'],
            default: 2
        }
    };

    /* RadarChart constructor
     *   element: the DOM element that will contain the PieChart
     *   data: the data id array
     *   contextId: optional.
     *   configuration: additional chart configuration:
     *      {
     *       ~ height: number - Height of the widget.
     *       ~ radius: number - The radius of the widget.
     *       ~ labels: array - Array of labels
     *       ~ labelsAssoc: array - Array of hashmaps with the association of metricName -> label. The order of the
     *         hashmaps determines the order of the datasets.
     *       ~ fillColor: string or Array - Fill color of the area between points. In case of array, it is one color for
     *         each of the datasets.
     *       ~ strokeColor: string or Array - Stroke color of the area between points. In case of array, it is one color
     *         for each of the datasets.
     *       ~ pointColor: string or Array - Color of the points.In case of array, it is one color
     *         for each of the datasets.
     *       ~ pointDot: boolean - Whether to show the points or not.
     *       ~ pointDotRadius: number - Radius of the points.
     *       ~ pointDotStrokeWidth: number - Width of the point strokes.
     *       ~ pointLabelFontSize: number - Font size for the points.
     *       ~ pointStrokeColor: string or Array - Color of the stroke of the points. In case of array, it is one color
     *         for each of the datasets.
     *       ~ pointHighlightFill: string or Array - Color to fill with the points when highlighted. In case of array,
     *         it is one color for each of the datasets.
     *       ~ pointHighlightStroke: string or Array - Stroke color of the points when highlighted. In case of array,
     *         it is one color for each of the datasets.
     *      }
     */
    var RadarChart = function RadarChart(element, metrics, contextId, configuration) {

        if(!framework.isReady()) {
            console.error("RadarChart object could not be created because framework is not loaded.");
            return;
        }

        // CHECK D3
        if(typeof d3 === 'undefined') {
            console.error("RadarChart could not be loaded because d3 did not exist.");
            return;
        }

        this.element = $(element); //Store as jquery object
        this.canvas = null;
        this.container = null;
        this.data = [];
        this.chart = null;
        this.status = 0; // 0 - not initialized, 1 - ready, 2 - destroyed

        // Extending widget
        framework.widgets.CommonWidget.call(this, false, this.element.get(0));

        // Configuration
        this.configuration = this.normalizeConfig(defaultConfig, configuration);

        this.observeCallback = this.commonObserveCallback.bind(this);

        framework.data.observe(metrics, this.observeCallback , contextId);

    };

    RadarChart.prototype = new framework.widgets.CommonWidget(true);

    RadarChart.prototype.updateData = function(framework_data) {

        if(this.status === 2)
            return;

        // Create the chart only once, then only will be updated
        if(this.status === 0) {
            createChart.call(this);
        }

        var normalizedData = getNormalizedData.call(this,framework_data);

        for(var i = 0, nItems = this.chart.datasets[0].points.length; i < nItems; ++i) {
            this.chart.removeData();
        }
        for(var label in normalizedData) {
            this.chart.addData( normalizedData[label], label );
        }
        this.chart.update();

    };

    RadarChart.prototype.delete = function() {

        // Has already been destroyed
        if(this.status === 2)
            return;

        //Stop observing for data changes
        framework.data.stopObserve(this.observeCallback);

        //Destroy the chart
        if(this.status === 1) {
            this.chart.destroy();
            this.container.empty();
        }

        //Clear DOM
        this.element.empty();

        this.data = [];
        this.canvas = null;
        this.container = null;
        this.chart = null;

        //Update status
        this.status = 2;

    };


    // PRIVATE METHODS - - - - - - - - - - - - - - - - - - - - - -

    /**
     * The dataset specific configuration can be a array specifying the value for each dataset or only one value
     * specifying the value for all the datasets.
     * @param config
     */
    var getDatasetSpecificConfig = function(config, dataset) {
        if(config instanceof Array) {
            return config[dataset];
        } else {
            return config;
        }
    };

    var createChart = function createChart() {
        if(this.canvas == null) {
            this.element.append('<div class="blurable"><canvas></canvas></div>');
            this.container = this.element.children("div");
            this.canvas = this.container.children("canvas");
            this.container.get(0).style.minHeight = this.configuration.height + "px";
            this.canvas.attr('height', this.configuration.radius * 2);
            this.canvas.attr('width', this.configuration.radius* 2);


            var ctx = this.canvas.get(0).getContext("2d");
            Chart.defaults.global.responsive = false; //TODO: responsive works rare

            var chartConfig = {
                labels: this.configuration.labels,
                datasets: []
            };

            for(var ds = 0; ds < this.configuration.labelsAssoc.length; ++ds) {
                chartConfig.datasets[ds] = {
                    fillColor: getDatasetSpecificConfig(this.configuration.fillColor, ds),
                    strokeColor: getDatasetSpecificConfig(this.configuration.strokeColor, ds),
                    pointColor: getDatasetSpecificConfig(this.configuration.pointColor, ds),
                    pointStrokeColor: getDatasetSpecificConfig(this.configuration.pointStrokeColor, ds),
                    pointHighlightFill: getDatasetSpecificConfig(this.configuration.pointHighlightFill, ds),
                    pointHighlightStroke: getDatasetSpecificConfig(this.configuration.pointHighlightStroke, ds),
                    data: []
                };
            }

            this.chart = new Chart(ctx).Radar(chartConfig, {
                scaleOverride: true,
                scaleSteps: 4,
                scaleStepWidth: 25,
                scaleStartValue: 0,
                pointDot: this.configuration.pointDot,
                pointDotRadius: this.configuration.pointDotRadius,
                pointDotStrokeWidth: this.configuration.pointDotStrokeWidth,
                pointLabelFontSize: this.configuration.pointLabelFontSize,
                pointLabelFontColor: this.configuration.pointLabelFontColor
            });
        }

        this.status = 1;
    };

    /**
     * Gets an object of data divided by label
     * @param framework_data
     * @returns {Object} Contains objects with 'label' and array of values.
     */
    var getNormalizedData = function getNormalizedData(framework_data) {

        var values = {};

        for(var resource in framework_data) {

            for(var resourceId in framework_data[resource]){

                var metric = framework_data[resource][resourceId];
                var metricData = framework_data[resource][resourceId]['data'];

                //Truncate decimals
                if(this.configuration.maxDecimals >= 0) {
                    var pow =  Math.pow(10, this.configuration.maxDecimals);
                    metricData['values'][0] = Math.floor(metricData['values'][0] * pow) / pow;
                }

                // Get the label of the metric witha function, a replace string or an association table
                //Is an array of hashmaps with pairs of metricName -> label
                var dataset, label;
                for(var i = 0; i < this.configuration.labelsAssoc.length; i++) {
                    if(this.configuration.labelsAssoc[i][resource] != null) {
                        label = this.configuration.labelsAssoc[i][resource];
                        dataset = i;
                        break;
                    }
                }

                //Add the value to the hash map in the corresponding label
                if(values[label] == null) {
                    values[label] = [];
                }
                values[label][dataset] = metricData['values'][0];
            }
        }

        return values;

    };

    window.framework.widgets.RadarChart = RadarChart;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( ['/vendor/Chart.js/Chart.js'], function () { return RadarChart; } );
    }

})();