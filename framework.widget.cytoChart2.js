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

    /* CytoChart2 constructor
     *   element: the DOM element that will contain the CytoChart2
     *   data: the data id array
     *   contextId: optional.
     *   configuration: additional chart configuration:
     *      {
     *      }
     */
    var CytoChart2 = function CytoChart2(element, metrics, contextId, configuration) {

        if(!framework.isReady()) {
            console.error("CytoChart2 object could not be created because framework is not loaded.");
            return;
        }

        // CHECK cytoscape
        if(typeof cytoscape === 'undefined') {
            console.error("CytoChart2 could not be loaded.");
            return;
        }

        // We need relative position for the nvd3 tooltips
        element.style.position = 'inherit';

        this.element = $(element); //Store as jquery object
        this.element.addClass('cytoChart2');
        this.data = null;
        this.chart = null;
        this.labels = {};

        // Extending widget
        framework.widgets.CommonWidget.call(this, false, this.element.get(0));

        // Configuration
        this.configuration = normalizeConfig(configuration);

        //this.element.append('<div id="cy"></div>');

        this.observeCallback = this.commonObserveCallback.bind(this);

        framework.data.observe(metrics, this.observeCallback , contextId);
    };

    CytoChart2.prototype = new framework.widgets.CommonWidget(true);

    CytoChart2.prototype.updateData = function(framework_data) {

        var normalizedData = getNormalizedData.call(this,framework_data);

        //Update data
        if(this.chart != null) {
            // Update
        } else { // Paint it for first time
            paint.call(this, normalizedData, framework_data);
        }

    };

    CytoChart2.prototype.delete = function() {

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

        var layoutConfig = {
            name: 'arbor',
            animate: true, // whether to transition the node positions
            animationDuration: 6000, // duration of animation in ms if enabled
            maxSimulationTime: 8000, // max length in ms to run the layout
            minNodeSpacing: 10, // min spacing between outside of nodes (used for radius adjustment)
            maxNodeSpacing: 70,
            boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
            avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
            infinite: true,
            'tension': 0.6,
            'repulsion': 700,
            'friction': 0.4,
            'gravity': true
        };
        var nodeStyle = {
            'width':  'data(w)',
            'height':  'data(h)',
            'background-fit': 'cover',
            'border-color': '#000',
            'border-width': 3,
            'border-opacity': 0.5,
            'shape': 'data(faveShape)',
        };
        var edgeStyle = {
            'width': 5,
            'target-arrow-shape': 't',
            'line-color': '#004C8B',
            'target-arrow-color': '#004C8B'
        };

        var cytoStyle = [
            {
                selector: 'node',
                style: nodeStyle
            },
            {
                selector: 'edge',
                style: edgeStyle
            }
        ];
        // Add style info for each node
        /*  cytoStyle.push({
                selector: '#bird',
                style: {
                        'background-image': 'https://farm8.staticflickr.com/7272/7633179468_3e19e45a0c_b.jpg'
                    }
            })
        */
        var styleInfo = [
            {
                selector: '#bird',
                style: {
                        'background-image': 'https://farm8.staticflickr.com/7272/7633179468_3e19e45a0c_b.jpg'
                    }
            },
            {
                selector: '#cat',
                style: {
                        'background-image': 'https://farm2.staticflickr.com/1261/1413379559_412a540d29_b.jpg'
                    }
            },
            {
                selector: '#ladybug',
                style: {
                        'background-image': 'https://farm4.staticflickr.com/3063/2751740612_af11fb090b_b.jpg'
                    }
            },
            {
                selector: '#aphid',
                style: {
                        'background-image': 'https://farm9.staticflickr.com/8316/8003798443_32d01257c8_b.jpg'
                    }
            },
            {
                selector: '#rose',
                style: {
                        'background-image': 'https://farm6.staticflickr.com/5109/5817854163_eaccd688f5_b.jpg'
                    }
            },
            {
                selector: '#grasshopper',
                style: {
                        'background-image': 'https://farm7.staticflickr.com/6098/6224655456_f4c3c98589_b.jpg'
                    }
            },
            {
                selector: '#plant',
                style: {
                        'background-image': 'https://farm1.staticflickr.com/231/524893064_f49a4d1d10_z.jpg'
                    }
            },
            {
                selector: '#wheat',
                style: {
                        'background-image': 'https://farm3.staticflickr.com/2660/3715569167_7e978e8319_b.jpg'
                    }
            },
            {
                selector: '#aphid2',
                style: {
                        'background-image': 'https://farm9.staticflickr.com/8316/8003798443_32d01257c8_b.jpg'
                    }
            },
            {
                selector: '#rose2',
                style: {
                        'background-image': 'https://farm6.staticflickr.com/5109/5817854163_eaccd688f5_b.jpg'
                    }
            },
            {
                selector: '#grasshopper2',
                style: {
                        'background-image': 'https://farm7.staticflickr.com/6098/6224655456_f4c3c98589_b.jpg'
                    }
            },
            {
                selector: '#plant2',
                style: {
                        'background-image': 'https://farm1.staticflickr.com/231/524893064_f49a4d1d10_z.jpg'
                    }
            },
            {
                selector: '#wheat2',
                style: {
                        'background-image': 'https://farm3.staticflickr.com/2660/3715569167_7e978e8319_b.jpg'
                    }
            }
        ];

        var theNodes = [
            { data: { id: 'cat', 'faveShape': 'ellipse', 'w': '100', 'h': '100'} },
            { data: { id: 'bird', 'faveShape': 'ellipse', 'w': '60', 'h': '60'} },
            { data: { id: 'grasshopper','faveShape': 'ellipse', 'w': '30', 'h': '30'} },
            { data: { id: 'plant', 'faveShape': 'ellipse', 'w': '75', 'h': '75'} },
            { data: { id: 'wheat', 'faveShape': 'ellipse', 'w': '50', 'h': '50'} }
        ];

        var theEdges = [
            { data: { source: 'cat', target: 'bird' } },
            { data: { source: 'cat', target: 'grasshopper' } },
            { data: { source: 'cat', target: 'plant' } },
            { data: { source: 'cat', target: 'wheat' } }
        ];

        var cytoElements = {
            nodes: theNodes,
            edges: theEdges
        };

        this.element.cytoscape({
          container: this.element.get(0),
          
            style: cytoStyle,
            elements: cytoElements, 
            layout: layoutConfig,
            boxSelectionEnabled: false
        }); // cy init

        cy = this.element.cytoscape('get');
        //cy.center();
        //cy.fit( cy.$('#j, #e') );
        cy.userPanningEnabled( false );
        cy.userZoomingEnabled(false);
        cy.nodes().unselectify();
        // Tooltip
        cy.nodes().qtip({
            content: function(){
                return 'Example qTip on ele ' + this.id();
            },
            show: {
                event: 'mouseover'
            },
            hide: {
                event: 'mouseout'
            },
            position: {
                my: 'top center',
                at: 'bottom center'
            },
            style: {
                classes: 'qtip-bootstrap',
                tip: {
                    width: 16,
                    height: 6
                }
            }
        });

        //Update the chart when window resizes.
        this.resizeEventHandler = function(e) {
            cy.resize();
        };
        $(window).resize(this.resizeEventHandler);

    };

    window.framework.widgets.CytoChart2 = CytoChart2;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( ['jquery-qtip', 'cytoscape', 'cytoscape-qtip'], function () { return CytoChart2; } );
    }

})();