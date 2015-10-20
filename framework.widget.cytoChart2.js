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

    var defaultConfig = {
        nodes: {
            type: ['object'],
            default: []
        },
        edges: {
            type: ['object'],
            default: []
        },
        mainNode: {
            type: ['string'],
            default: null // TODO
            /*
            if(configuration.nodes.length > 0) {
                configuration.mainNode = configuration.nodes[0].id;
            } else {
                configuration.mainNode = null;
            }
            */
        }
    };

    /* CytoChart2 constructor
     *   element: the DOM element that will contain the CytoChart2
     *   data: the data id array
     *   contextId: optional.
     *   configuration: additional chart configuration:
     *      {
     *      ~ node: array - Nodes to paint [{ 'id': 'nodeId', 'avatar':avatarURL, 'shape': 'svgShape', metric:"metricId" },...]
     *      ~ edge: array - Edges to paint [{ source: 'nodeId1', target: 'nodeId2' }]
     *      ~ mainNode: string - The nodeId for the main Node (static size)
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
        this.config = this.normalizeConfig(defaultConfig, configuration);


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

                // Metric dataset
                var dat = yserie.map(function(dat, index) {
                    timePoint += metricData.step;
                    return {'x': new Date(new Date(timePoint).getTime()), 'y': dat};
                });
                //var label = genLabel.call(this, 0);
                series[metricId] = yserie[0];
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

        var theNodes = [];
        var theEdges = [];
        var theNod;

        // Add style info for each node
        for (var i= 0; i < this.config.nodes.length; i++) {
            theNod = this.config.nodes[i];
            if(theNod.id == this.config.mainNode) {
                continue
            }
        }
        
        for (var i= 0; i < this.config.nodes.length; i++) {
            theNod = this.config.nodes[i];
            var theValue = data[theNod.metric];
            // TODO test
            if(theValue > 99) {
                theValue = (Math.random() * 1000) % 100;
            }
            if(theValue < 20) {
                theValue = 25;
            }
            var size = {};
            if (theNod.id == this.config.mainNode) {
                size['w'] = 100;
                size['h'] = 100;
            } else {
                console.log("theNod.metric value-> "+ data[theNod.metric]);
                size['w'] = theValue;
                size['h'] = theValue;
            }
            // node
            theNodes.push({
                data: {
                    id: theNod.id,
                    faveShape: theNod.shape,
                    w: size.w,
                    h: size.h,
                }
            });
            // style
            cytoStyle.push({
                selector: '#' + theNod.id,
                style: {
                    'background-image': theNod.avatar
                }
            });
        }
        var theEdge;
        for (var i= 0; i < this.config.edges.length; i++) {
            theEdge = this.config.edges[i]
            theEdges.push({
                data: {
                    source: theEdge.source,
                    target: theEdge.target,
                }
            });

        }

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