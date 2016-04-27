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
            staticSize: {
                type: ['number'],
                default: 100
            }
        };

        /* CytoChart2 constructor
         *   element: the DOM element that will contain the CytoChart2
         *   data: the data id array
         *   contextId: optional.
         *   configuration: additional chart configuration:
         *      {
         *      ~ node: array - Nodes to paint [{ 'id': 'nodeId', 'avatar':avatarURL, 'shape': 'svgShape', volume:"metrichashId" or "_static_", tooltip: 'text' },...]
         *      ~ edge: array - Edges to paint [{ source: 'nodeId1', target: 'nodeId2' }]
         *      ~ staticSize: number - static size for _static_ nodes
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
            this.status = 0; // 0 - not initialized, 1 - ready, 2 - destroyed
            this.onResizeTimeout = null;

            // Extending widget
            framework.widgets.CommonWidget.call(this, false, this.element.get(0));

            // Configuration
            this.config = this.normalizeConfig(defaultConfig, configuration);

            this.element.append('<div class="cytoContainer blurable"></div>');
            this.cytoContainer = this.element.find('.cytoContainer');

            this.observeCallback = this.commonObserveCallback.bind(this);

            framework.data.observe(metrics, this.observeCallback , contextId);
        };

        CytoChart2.prototype = new framework.widgets.CommonWidget(true);

        CytoChart2.prototype.updateData = function(framework_data) {

            //Has been destroyed
            if(this.status === 2)
                return;

            var normalizedData = getNormalizedData.call(this,framework_data);
            this.lastData = framework_data;

            //Update data
            if(this.status === 1) {
                repaint.call(this, normalizedData, framework_data);
            } else { // Paint it for first time
                paint.call(this, normalizedData, framework_data);
            }

        };

        CytoChart2.prototype.delete = function() {

            // Has already been destroyed
            if(this.status === 2)
                return;

            //Stop observing for data changes
            framework.data.stopObserve(this.observeCallback);

            if(this.status === 1) {

                //Remove resize event listener
                $(window).off("resize", this.resizeEventHandler);
                this.resizeEventHandler = null;

                // Destroy also removes the container
                this.chart.destroy();
                this.chart = null;
            }

            //Clear DOM
            this.element.empty();

            this.cytoContainer = null;

            //Update status
            this.status = 2;

        };

        /**
         * Gets a normalized array of data according to the chart expected input from the data returned by the framework.
         * @param framework_data
         * @returns {Array} Contains objects with 'label' and 'value'.
         */
        var getNormalizedData = function getNormalizedData(framework_data) {

            var nodeInfo = [];
            this.labels = {};

            for (var resourceName in framework_data) {
                for (var resId in framework_data[resourceName]) {

                    var metric = framework_data[resourceName][resId];
                    var metricData = framework_data[resourceName][resId]['data'];

                    nodeInfo[metric.info.UID] = {
                        value: metricData.values[0],
                        resource: resourceName,
                        resourceId: resId
                    };
                }
            }

            return nodeInfo;
        };

        var repaint = function repaint(data, framework_data) {

            // Destroy the chart
            this.chart.destroy(); //Destroy also removes the container

            // Create a new container
            this.cytoContainer = $('<div class="cytoContainer blurable"></div>');
            this.element.append(this.cytoContainer);

            // Paint again
            paint.call(this, data, framework_data);
        };

        var paint = function paint(data, framework_data) {
            var width = this.element.get(0).getBoundingClientRect().width;
            //TODO get this values from data

            var layoutConfig = {
                name: 'cola',
                animate: true, // whether to transition the node positions
                animationDuration: 6000, // duration of animation in ms if enabled
                maxSimulationTime: 8000, // max length in ms to run the layout
                minNodeSpacing: 10, // min spacing between outside of nodes (used for radius adjustment)
                maxNodeSpacing: 70,
                boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
                avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
                infinite: false,
                'tension': 0.6,
                'repulsion': 700,
                'friction': 0.4,
                'gravity': true
            };
            var nodeStyle = {
                'width':  'data(w)',
                'height':  'data(h)',
                'background-fit': 'cover',
                'border-color': '#004C8B',
                'border-width': 2,
                //'border-opacity': 0.5,
                'shape': 'data(faveShape)',
                'background-color': 'white'
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
                var size;
                var tooltip = theNod.tooltip;

                var nodData = data[theNod['metric']];
                var metric = framework_data[nodData['resource']][nodData['resourceId']];
                if(typeof tooltip === 'function') {
                    tooltip = tooltip(metric, {resource: nodData['resource'], resourceId:  nodData['resourceId']});
                } else {
                    tooltip = this.replace(tooltip, metric, {resource: nodData['resource'], resourceId:  nodData['resourceId']});
                }

                if (theNod['volume'] == '_static_') {
                    size = this.config.staticSize;
                } else {
                    var theValue = data[theNod.metric].value;
                    // TODO test
                    if(theValue > 99) {
                        theValue = 99;
                    } else if(theValue < 20) {
                        theValue = 25;
                    }
                    size = theValue;

                }
                // node
                theNodes.push({
                    data: {
                        id: theNod.id,
                        faveShape: theNod.shape,
                        w: size,
                        h: size,
                        tooltip: tooltip
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
                theEdge = this.config.edges[i];
                theEdges.push({
                    data: {
                        source: theEdge.source,
                        target: theEdge.target
                    }
                });

            }

            var cytoElements = {
                nodes: theNodes,
                edges: theEdges
            };

            this.cytoContainer.cytoscape({
                container: this.cytoContainer.get(0),
                style: cytoStyle,
                elements: cytoElements,
                layout: layoutConfig,
                boxSelectionEnabled: false
            }); // cy init

            cy = this.cytoContainer.cytoscape('get');
            this.chart = cy;
            //cy.center();
            //cy.fit( cy.$('#j, #e') );
            cy.userPanningEnabled( false );
            cy.userZoomingEnabled(false);
            cy.nodes().unselectify();
            // Tooltip
            cy.nodes().qtip({
                content: function(){
                    return this._private.data.tooltip;
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
                // dont run
                    //this.chart.resize();

                // Wait some time to repaint and do it only once
                if(this.onResizeTimeout == null) {
                    this.onResizeTimeout = setTimeout(function() {

                        //Has been destroyed
                        if(this.status === 2)
                            return;

                        var normalizedData = getNormalizedData.call(this,this.lastData);
                        repaint.call(this, normalizedData, framework_data);

                        this.onResizeTimeout = null;
                    }.bind(this), 3000);
                }

                // ñaping
                    //this.chart._invokeListeners({group:'nodes', type:'click', target: this.config.mainNode});
            }.bind(this);
            $(window).resize(this.resizeEventHandler);

            // Set the chart as ready
            this.status = 1;

        };

        window.framework.widgets.CytoChart2 = CytoChart2;
        return CytoChart2;

    });

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [
            'sdh-framework/widgets/Common/common',
            'jquery-qtip',
            'cytoscape',
            'cytoscape-qtip',
            'css!./cytoChart2.css'
        ], function () {
            return __loader();
        } );
    } else {
        __loader();
    }

})();