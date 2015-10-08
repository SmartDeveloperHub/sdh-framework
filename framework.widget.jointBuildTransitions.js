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
    var joint= null;

    var normalizeConfig = function normalizeConfig(configuration) {
        if (typeof configuration !== 'object') {
            configuration = {};
        }

        if (typeof configuration.label !== 'string') {
            configuration.label = "---";
        }

        if (typeof configuration.background !== 'string') {
            configuration.background = "#FFF";
        }

        if (typeof configuration.iconbackground !== 'string') {
            configuration.iconbackground = "#68B828";
        }

        if (typeof configuration.initfrom !== "number") {
            configuration.initfrom = 0;
        }

        if (typeof configuration.initto !== "number") {
            configuration.initto = 0;
        }

        if (typeof configuration.changetime !== "number") {
            configuration.changetime = 3;
        }

        if (typeof configuration.changeeasing !== "boolean") {
            configuration.changeeasing = true;
        }

        if (typeof configuration.label2 !== "string") {
            configuration.label2 = true;
        }

        if (typeof configuration.label2color !== "string") {
            configuration.label2color = "rgba(0, 0, 0, 0.7)";
        }

        if (typeof configuration.counter2color !== "string") {
            configuration.counter2color = "#000";
        }

        if (typeof configuration.decimal2 !== "number") {
            configuration.decimal2 = 2;
        }

        if (typeof configuration.icon !== "string") {
            configuration.icon = "octicon octicon-octoface";
        }

        if (typeof configuration.iconcolor !== "string") {
            configuration.iconcolor = "#FFF";
        }

        if (typeof configuration.labelcolor !== "string") {
            configuration.labelcolor = "rgba(0, 0, 0, 0.7)";
        }

        if (typeof configuration.countercolor !== "string") {
            configuration.countercolor = "#000";
        }

        if (typeof configuration.decimal !== "number") {
            configuration.decimal = 2;
        }
        return configuration;
    };

    /* BuildTransitions constructor
    *   element: the DOM element that will contains the BuildTransitions div
    *   data: the data id array
    *   contextId: if necesary, the contextId link this chart data data
    *           with changes in other context provider chart.
    *  configuration: you can use his optional parameter to assing a custom
    *       contextID for this context provider chart. Ej:
    *      {
    *         label: label text,
    *         labelcolor: label text color,
    *         countercolor: color of the number,
    *         label2: label2 text,
    *         label2color: label2 text color,
    *         counter2color: color of the second counter number,
    *         background: optional color in any css compatible format ej: "#0C0C0C" (default #FFF),
    *         initfrom: optional initial animation value (default 0),
    *         initto: optional final animation value (default 0),
    *         changetime: this time in seconds set the change data animation duration (default 3),
    *         changeeasing: optional animation effect data-easing fast-slow (default true),
    *         icon: optional icon css class (default "octicon octicon-octoface"),
    *         iconcolor: widget icon color,
    *         iconbackground: optional color in any css compatible format ej: "#0C0C0C" (default #68B828),
    *         decimal: number of decimals in metric value
    *      }
    */
    var BuildTransitions = function BuildTransitions(element, metrics, contextId, configuration) {
        console.log("BuildTransitions 1");
        if(!framework.isReady()) {
            console.error("BuildTransitions object could not be created because framework is not loaded.");
            return;
        }

        // CHECK Joint.js
        if(typeof joint === 'undefined') {
            console.log("BuildTransitions could not be loaded.");
            //return;
        }

        // extending widget
        this.element = $(element);
        framework.widgets.CommonWidget.call(this, false, this.element.get(0));

        // Configuration
        //this.configuration = normalizeConfig(configuration);
        this.configuration = configuration;

        this.observeCallback = this.commonObserveCallback.bind(this);

        framework.data.observe(metrics, function(e) {
                this.observeCallback(e);
            }.bind(this),
            contextId, 1
        );

    };

    BuildTransitions.prototype = new framework.widgets.CommonWidget(true);

    BuildTransitions.prototype.updateData = function(framework_data) {
        console.log("Updating BuildTransitions 1");
        var normalizedData = getNormalizedData.call(this,framework_data);

        //Update data
        if(this.chart != null) {
            updateValues.call(this, normalizedData);
        } else { // Paint it for first time
            paint.call(this, normalizedData, framework_data);
        }
    };

    BuildTransitions.prototype.delete = function() {

        //Stop observing for data changes
        framework.data.stopObserve(this.observeCallback);

        //Clear DOM
        $(this.container).empty();
        this.element.empty();

    };

    var currentValues = {
            "pas_pas": 0,
            "pas_brk": 0,
            "brk_fix": 0,
            "fix_pas": 0,
            "fix_fai": 0,
            "fai_fai": 0,
            "fai_fix": 0
    };
    // TODO take this from config
    var flagMat = {
            paspasmetricid: "pas_pas",
            pasbrkmetricid: "pas_brk",
            brkfixmetricid: "brk_fix",
            fixpasmetricid: "fix_pas",
            fixfaimetricid: "fix_fai",
            faifaimetricid: "fai_fai",
            faifixmetricid: "fai_fix"
    };

    /**
     * random number from interval.
     * @param min
     * @param max
     * @returns {Number} random number
     */
    var randomIntFromInterval = function randomIntFromInterval(min,max) {
        return Math.floor(Math.random()*(max-min+1)+min);
    };

    /**
     * Update link values.
     * @param data
     * @returns {Array} Contains objects with 'label' and 'value'.
     */
    var updateValues = function updateValues(framework_data) {
        //TODO use real data
        /*for (var metricId in framework_data) {
            for (var m in framework_data[metricId]) {
                // only 1
                currentValues[flagMat[metricId]] = framework_data[metricId][m]['data'][0];
            }
        }*/
        currentValues = {
            "contingencyLink": 0,
            "pas_brk": randomIntFromInterval(1000,10000),
            "brk_fix": randomIntFromInterval(1000,10000),
            "pas_pas": randomIntFromInterval(1000,10000),
            "brk_fai": randomIntFromInterval(1000,10000),
            "fix_pas": randomIntFromInterval(1000,10000),
            "fix_brk": randomIntFromInterval(1000,10000),
            "fai_fai": randomIntFromInterval(1000,10000),
            "fai_fix": randomIntFromInterval(1000,10000)
        };
        var realTitles = {
            "contingencyLink": {tit: "", className: "red"},
            "pas_brk": {tit: "Passed Broken", className: "red"},
            "brk_fix": {tit: "Broken Fixed", className: "green"},
            "brk_fai": {tit: "Broken Failed", className: "red"},
            "fix_pas": {tit: "Fixed Passed", className: "green"},
            "fix_brk": {tit: "Fixed Broken", className: "red"},
            "fai_fai": {tit: "Failed Failed", className: "red"},
            "fai_fix": {tit: "Failed Fixed", className: "green"},
            "pas_pas": {tit: "Passed Passed", className: "green"}
        };
        for (var key in this.linksById) {
            this.linksById[key].label(0, {
                position: .5,
                attrs: {
                    text: { text: currentValues[key], class: key}
                }
            });
            //Tooltip
            var tspan = this.element.find('.link').find('.label').find('.' + key).find('tspan');
            $(tspan).qtip(
            {
                id: realTitles[key],
                content: {
                    text: function(val, title, classN) {
                        return "<strong class='tooltipCounter " + classN + "'>" + val + "</strong> " + title + " executions";
                    }.bind(this, currentValues[key], realTitles[key].tit, realTitles[key].className),
                    title: function(title, classN) {
                        return "<strong class='tooltipTitle " + classN + "'>" + title + "</strong>";
                    }.bind(this, realTitles[key].tit, realTitles[key].className)
                },
                show: {
                    event: 'mouseenter'
                },
                hide: {
                    event: 'mouseleave unfocus'
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
            }
        );
        }

    };

    /**
     * Gets a normalized array of data according to the chart expected input from the data returned by the framework.
     * @param framework_data
     * @returns {Array} Contains objects with 'label' and 'value'.
     */
    var getNormalizedData = function getNormalizedData(framework_data) {
        return framework_data;
    };

    var getBallTolltip = function(className, title, description) {
        return {
            id: title,
            content: {
                text: function(classN, desc) {
                    return "<span class='ballDescription " + classN + "'>" + desc + "</span>";
                }.bind(this, className, description),
                title: function(title, classN) {
                    return "<strong class='tooltipTitle " + classN + "'>" + title + "</strong>";
                }.bind(this, title, className)
            },
            show: {
                event: 'mouseenter'
            },
            hide: {
                event: 'mouseleave unfocus'
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
        };
    };

    /**
     * Gets a normalized array of data according to the chart expected input from the data returned by the framework.
     * @param framework_data
     * @returns {Array} Contains objects with 'label' and 'value'.
     */
    var paint = function paint(normalizedData, framework_data) {
        //require(['joint'], function(joint) {
        var graph = new joint.dia.Graph();

        var paper = new joint.dia.Paper({
            el: this.element,
            width: 540,
            height: 348,
            gridSize: 10,
            perpendicularLinks: true,
            model: graph,
            interactive: false
        });

        var pn = joint.shapes.pn;

        // Generic box
        var genericBox = new pn.Transition({
            size: { width: 70, height: 70 },
            attrs: {
                '.label': { fill: 'black'},
                '.root' : { fill: '#9586fd', stroke: '#9586fd' }
            }
        });

        //Generic Ball
        var genericBall = new pn.Place({
            position: { x: 200, y: 50 },
            size: { width: 70, height: 70 },
            attrs: {
                '.root' : { stroke: '#9586fd', 'stroke-width': 3},
                '.tokens > circle': { fill : '#7a7e9b'}
            }
        });

        var passedBall = genericBall.clone().attr({
            '.alot > text': {
                'fill': 'green',
                'font-size': 12
            }
        }).position(60, 60).set('tokens', "Passed");

        var brokenBall = genericBall.clone().attr({
            '.alot > text': {
                'fill': 'red',
                'font-size': 12
            }
        }).position(60, 225).set('tokens', 'Broken');

        var fixedBall = genericBall.clone().attr({
            '.alot > text': {
                'fill': 'green',
                'font-size': 12
            }
        }).position(400, 60).set('tokens', 'Fixed');

        var failedBall = genericBall.clone().attr({
            '.alot > text': {
                'fill': 'red',
                'font-size': 12
            }
        }).position(400, 225).set('tokens', 'Failed');

        this.linksById = {};

        var link = function link (a, b, type, linkShape, color, position) {
            if (typeof position !== 'number') {
                position = .2;
            } else {
                console.log(position);
            }
            var connectSettings = {
                'fill': 'none',
                'stroke-linejoin': 'none',
                'stroke-width': '2',
                'stroke': '#4b4a67'
            };
            var marker_target = {
                fill: '#004C8B',
                d: 'M 10 0 L 0 5 L 10 10 z'
            }

            if (type == 'contingencyLink') {
                connectSettings = {
                    'fill': 'none',
                    'stroke-linejoin': 'none',
                    'stroke-width': '0',
                    'stroke': 'transparent'
                }
                marker_target = {
                    fill: '#004C8B',
                    d: ''
                }
            }
            var newLink = new pn.Link({
                source: { id: a.id, selector: '.root'},
                target: { id: b.id, selector: '.root' },
                attrs: {
                    '.connection': connectSettings,
                    '.marker-target': marker_target
                },
                labels: [
                    {
                        position: position,
                        attrs: { 
                            rect: { fill: 'white' },
                            text: {
                                'fill': color,
                                'text': "",
                                'font-family': 'Courier New',
                                'font-size': 20,
                                'font-weight': 'bold',
                                'ref-x': 0.5,
                                'ref-y': 0.5
                            } 
                        }
                    }
                ]
            });
            //newLink.set('manhattan', true);
            //newLink.set('smooth', true);
            //newLink.set('orthogonal', true);
            if (typeof linkShape !== 'object' || linkShape == null) {
                newLink.set("smooth", true);
            } else {
                for (var i = linkShape.length - 1; i >= 0; i--) {
                    newLink.set(linkShape[i], true);
                };
            }
            this.linksById[type] = newLink;

            // Ñapping edges
            if (type == "brk_fix") {
                newLink.set("vertices", [{ x: 255, y: 155 }]);
            } else if (type == "fix_brk") {
                newLink.set("vertices", [{ x: 280, y: 200 }]);
            } else if (type == "fai_fai") {
                newLink.set("vertices", [{ x: 502, y: 317 }]);
            }

            return newLink;
        }.bind(this); // Link

        graph.addCell([ passedBall, brokenBall, fixedBall, failedBall]);

        graph.addCell([
            link(fixedBall, fixedBall, "contingencyLink", null, 'transparent'),
            link(failedBall, failedBall, "fai_fai", ["manhattan", "smooth"], 'red'),
            link(passedBall, passedBall, "pas_pas", ["manhattan", "smooth"], 'green'),
            link(passedBall, brokenBall, "pas_brk", null, 'red'),
            link(brokenBall, fixedBall, "brk_fix", null, 'green'),
            link(brokenBall, failedBall, "brk_fai", null, 'red'),
            link(fixedBall, passedBall, "fix_pas", null, 'green'),
            link(fixedBall, brokenBall, "fix_brk", ["smooth"], 'red', 0),
            link(failedBall, fixedBall, "fai_fix", null, 'green', -0.1)
        ]);

        // Add ball tooltips
        var fixedViewId = paper.findViewByModel(fixedBall).el.id;
        $('#'+fixedViewId).qtip(getBallTolltip.call(this, 'green', 'Fixed', 'This element represent Fixed execution state'))

        var passedViewId = paper.findViewByModel(passedBall).el.id;
        $('#'+passedViewId).qtip(getBallTolltip.call(this, 'green', 'Passed', 'This element represent Passed execution state'))

        var brokenViewId = paper.findViewByModel(brokenBall).el.id;
        $('#'+brokenViewId).qtip(getBallTolltip.call(this, 'red', 'Broken', 'This element represent Broken execution state'))

        var failedViewId = paper.findViewByModel(failedBall).el.id;
        $('#'+failedViewId).qtip(getBallTolltip.call(this, 'red', 'Failed', 'This element represent Failed execution state'))

        function fireTransition(t, sec) {

            var allbound = graph.getConnectedLinks(t);
            var elemcolors = [];
            var color;
            for (var i = 0; i < allbound.length; i++) {
                var source = graph.getCell(allbound[i].get('source').id);
                var target = graph.getCell(allbound[i].get('target').id);
                var sourceid = source.attributes.tokens;
                var targetid = target.attributes.tokens;
                // contingency
                if (targetid == "Fixed" && sourceid == "Fixed") {
                    continue;
                }
                if (targetid == "Failed" || targetid == "Broken") {
                    color = "red";
                } else {
                    color = "green";
                }

                elemcolors.push({target : target, source : source, color: color});
            }

            var isFirable = true;

            if (isFirable) {
                _.each(elemcolors,
                    function(p) {
                        var link = _.find(allbound, function(l) {
                        return (l.get('target').id === p.target.id) && (l.get('source').id === p.source.id)
                    });
                    paper.findViewByModel(link).sendToken(joint.Vectorizer('circle', { r: 7, fill: p.color }).node, sec * 1300);
                });
            }
        }

        function simulate() {
            var transitions = [passedBall, failedBall, brokenBall, fixedBall];
            _.each(transitions, function(t) { fireTransition(t, 1); });
            return setInterval(function() {
                _.each(transitions, function(t) { fireTransition(t, 1); });
            }, 10000);
        }

        function stopSimulation(simulationId) {
            clearInterval(simulationId);
        }

        //var simulationId = simulate();

        updateValues.call(this, normalizedData);

        //Update the chart when window resizes.
        this.resizeEventHandler = function(e) {
            console.log("TODO resize");
            
        };
        $(window).resize(this.resizeEventHandler);

        //}).bind(this);
    };

    window.framework.widgets.BuildTransitions = BuildTransitions;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( ['joint'], function (_joint) {
            joint = _joint;
            return BuildTransitions;
        });
    }

})();