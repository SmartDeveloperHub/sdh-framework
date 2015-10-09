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

    var cy;

    var normalizeConfig = function normalizeConfig(configuration) {
        if (configuration == null) {
            configuration = {};
        }
        return configuration;
    };

    /* CytoChart constructor
     *   element: the DOM element that will contain the CytoChart
     *   data: the data id array
     *   contextId: optional.
     *   configuration: additional chart configuration:
     *      {
     *      }
     */
    var CytoChart = function CytoChart(element, metrics, contextId, configuration) {

        if(!framework.isReady()) {
            console.error("CytoChart object could not be created because framework is not loaded.");
            return;
        }

        // CHECK cytoscape
        if(typeof cytoscape === 'undefined') {
            console.error("CytoChart could not be loaded.");
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

        this.element.append('<div id="cy"></div>');

        this.observeCallback = this.commonObserveCallback.bind(this);

        framework.data.observe(metrics, this.observeCallback , contextId);
    };

    CytoChart.prototype = new framework.widgets.CommonWidget(true);

    CytoChart.prototype.updateData = function(framework_data) {

        var normalizedData = getNormalizedData.call(this,framework_data);

        //Update data
        if(this.chart != null) {
            // Update
        } else { // Paint it for first time
            paint.call(this, normalizedData, framework_data);
        }

    };

    CytoChart.prototype.delete = function() {

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

                if(metric['info']['request']['params']['max'] > 0) {
                    this.aproximatedDates = true;
                }

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
        //TODO get this values from data
        var pas_pas = "1045";
        var pas_bro = "340";
        var bro_fix = "341";
        var fix_fai = "320";
        var fix_pas = "803";
        var fai_fix = "543";
        var fai_fai = "239";

        var layoutOpt = {
            'name': 'arbor',
            'animate': false, // whether to show the layout as it's running
            //'maxSimulationTime': 6000, // max length in ms to run the layout
            'fit': true, // on every layout reposition of nodes, fit the viewport
            'ungrabifyWhileSimulating': true, // so you can't drag nodes during layout
            'repulsion': 2500,
            'friction': 0.9,
            'gravity': true,
            'precision': 0.9,
            'stepSize': 0.4 // smoothing of arbor bounding box
        };
        $('#cy').cytoscape({
            layout: layoutOpt,

            style: cytoscape.stylesheet()
            .selector('node')
            .css({
                'shape': 'data(faveShape)',
                'width': 180,
                'height': 80,
                'content': 'data(name)',
                'text-valign': 'center',
                'text-outline-width': 2,
                'text-outline-color': 'data(faveColor)',
                'background-color': 'data(faveColor)',
                'color': '#fff',
                'border-width': 2,
                'border-opacity': 0.7,
                'shadow-color': '#484849',
                'shadow-opacity': 0.5,
                'shadow-offset-x': 0,
                'shadow-offset-y': 0,
                'shadow-blur': 2,
                'font-size': 30,
            })
            .selector(':selected')
            .css({
                'border-width': 3,
                'border-color': '#333'
            })
            .selector('edge')
            .css({
                'opacity': 0.666,
                'width': 10,
                'target-arrow-shape': 'triangle',
                'line-color': 'data(faveColor)',
                'source-arrow-color': 'data(faveColor)',
                'target-arrow-color': 'data(faveColor)',
                'content': 'data(label)',
                'color': 'blue',
                //'edge-text-rotation': 'autorotate',
                'text-valign': 'top',
                'text-wrap': 'none',
                'curve-style': 'bezier',
                'font-size': 40
            })
            .selector('edge.questionable')
            .css({
                'line-style': 'dotted',
                'target-arrow-shape': 'diamond'
            })
            .selector('.faded')
            .css({
                'opacity': 0.25,
                'text-opacity': 0
            }),

            elements: {
            nodes: [
                { data: { id: 'p', name: 'Passed', faveColor: '#008000', faveShape: 'ellipse' } },
                { data: { id: 'f', name: 'Failed', faveColor: '#CA0000', faveShape: 'ellipse' } },
                { data: { id: 'x', name: 'Fixed', faveColor: '#008000', faveShape: 'ellipse' } },
                { data: { id: 'b', name: 'Broken', faveColor: '#CA0000', faveShape: 'ellipse' } }
            ],
            edges: [
                { data: { source: 'p', target: 'p', faveColor: '#008000', label:  + "\n\n" +pas_pas} },
                { data: { source: 'p', target: 'b', faveColor: '#CA0000', label:  + "\n\n" +pas_bro} },
                { data: { source: 'b', target: 'x', faveColor: '#008000', label:  + "\n\n"+bro_fix + "\n\n"} },

                { data: { source: 'x', target: 'p', faveColor: '#008000', label: fix_pas + "\n\n"} },
                { data: { source: 'x', target: 'f', faveColor: '#CA0000', label: fix_fai + "\n\n"} },

                { data: { source: 'f', target: 'x', faveColor: '#008000', label: fai_fix + "\n\n"} },
                { data: { source: 'f', target: 'f', faveColor: '#CA0000', label: fai_fai + "\n\n"} }
            ]
            },

            ready: function() {
                //cy.zoomingEnabled(false);
                //cy.panningEnabled(false);
                cy = $('#cy').cytoscape('get');
            },
            done: function() {
                cy.zoomingEnabled(false);
                cy.panningEnabled(false);
            }
        });

        cy = $('#cy').cytoscape('get');

        //Update the chart when window resizes.
        this.resizeEventHandler = function(e) {
            //$('#cy').width = e.width;
            //cy.resize();
            var lay = cy.makeLayout(layoutOpt);
            lay.stop();
            lay.run();
        };
        $(window).resize(this.resizeEventHandler);

    };

    window.framework.widgets.CytoChart = CytoChart;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [], function () { return CytoChart; } );
    }

})();