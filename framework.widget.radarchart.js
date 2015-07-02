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
            labels: {
                type: 'object',
                default: []
            },
            fillColor: {
                type: 'string',
                default: 'rgba(22,22,220,0.2)'
            },
            strokeColor: {
                type: 'string',
                default: 'rgba(22,22,220,0.5)'
            },
            pointColor: {
                type: 'string',
                default: 'rgba(22,22,220,0.75)'
            },
            pointDot: {
                type: 'boolean',
                default: true
            },
            pointDotRadius: {
                type: 'number',
                default: 3
            },
            pointDotStrokeWidth: {
                type: 'number',
                default: 1
            },
            pointLabelFontSize: {
                type: 'number',
                default: 12
            },
            pointLabelFontColor: {
                type: 'string',
                default: '#666'
            },
            pointStrokeColor: {
                type: 'string',
                default: "#fff"
            },
            pointHighlightFill: {
                type: 'string',
                default: "#fff"
            },
            pointHighlightStroke: {
                type: 'string',
                default: "rgba(22,22,220,1)"
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

    /* PieChart constructor
     *   element: the DOM element that will contain the PieChart
     *   data: the data id array
     *   contextId: optional.
     *   configuration: additional chart configuration:
     *      {
     *       ~ height: number - Height of the widget.
     *       ~ labels: array - Array of labels
     *       ~ fillColor: string - Fill color of the area between points.
     *       ~ strokeColor: string - Stroke color of the area between points.
     *       ~ pointColor: string - Color of the points.
     *       ~ pointDot: boolean - Whether to show the points or not.
     *       ~ pointDotRadius: number - Radius of the points.
     *       ~ pointDotStrokeWidth: number - Width of the point strokes.
     *       ~ pointLabelFontSize: number - Font size for the points.
     *       ~ pointStrokeColor: string - Color of the stroke of the points.
     *       ~ pointHighlightFill: string - Color to fill with the points when highlighted.
     *       ~ pointHighlightStroke: string - Stroke color of the points when highlighted.
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

        // Extending widget
        framework.widgets.CommonWidget.call(this, false, this.element.get(0));

        // Configuration
        this.configuration = normalizeConfig(configuration);

        // Create the chart only once, then only will be updated
        createChart.call(this);

        this.observeCallback = this.commonObserveCallback.bind(this);

        framework.data.observe(metrics, this.observeCallback , contextId);

    };

    RadarChart.prototype = new framework.widgets.CommonWidget(true);

    RadarChart.prototype.updateData = function(framework_data) {

        var normalizedData = getNormalizedData.call(this,framework_data);

        for(var i = 0, nItems = this.chart.datasets[0].points.length; i < nItems; ++i) {
            this.chart.removeData();
        }
        for(var i = 0; i < normalizedData.length; i++) {
            var label = (i < this.configuration.labels.length ? this.configuration.labels[i] : "Data " + i);
            this.chart.addData( [normalizedData[i]], label );
        }
        this.chart.update();

    };

    RadarChart.prototype.delete = function() {

        //Stop observing for data changes
        framework.data.stopObserve(this.observeCallback);

        //Destroy the chart
        this.chart.destroy();

        //Clear DOM
        this.container.empty();
        this.element.empty();

        this.data = [];
        this.canvas = null;
        this.container = null;
        this.chart = null;

    };


    // PRIVATE METHODS - - - - - - - - - - - - - - - - - - - - - -

     var createChart = function createChart() {
        if(this.canvas == null) {
            this.element.append('<div class="blurable"><canvas></canvas></div>');
            this.container = this.element.children("div");
            this.canvas = this.container.children("canvas");
            this.container.attr('height', this.configuration.height);
            this.canvas.attr('height', this.configuration.height);


            var ctx = this.canvas.get(0).getContext("2d");
            Chart.defaults.global.responsive = false; //TODO: responsive works rare

            var chartConfig = {
                labels: this.configuration.labels,
                datasets: [{
                    fillColor: this.configuration.fillColor,
                    strokeColor: this.configuration.strokeColor,
                    pointColor: this.configuration.pointColor,
                    pointStrokeColor: this.configuration.pointStrokeColor,
                    pointHighlightFill: this.configuration.pointHighlightFill,
                    pointHighlightStroke: this.configuration.pointHighlightStroke,
                    data: []
                }]
            };

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
    };

    /**
     * Gets a normalized array of data according to the chart expected input from the data returned by the framework.
     * @param framework_data
     * @returns {Array} Contains objects with 'label' and 'value'.
     */
    var getNormalizedData = function getNormalizedData(framework_data) {

        var values = [];

        for(var metricId in framework_data) {

            for(var m in framework_data[metricId]){

                var metricData = framework_data[metricId][m]['data'];

                values.push(metricData['values'][0]);
            }
        }

        return values;

    };

    window.framework.widgets.RadarChart = RadarChart;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( ['sdh-framework/lib/chart.js/Chart.min.js'], function () { return RadarChart; } );
    }

})();