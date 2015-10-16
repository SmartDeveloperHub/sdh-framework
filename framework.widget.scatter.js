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
        },
        image: {
            type: ['string'],
            default: null
        },
        imageMargin: {
            type: ['number'],
            default: 10
        },
        minDiameter: {
            type: ['number'],
            default: 50
        },
        maxDiameter: {
            type: ['number'],
            default: 150
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
     *       ~ size: function - Function to decide the size of the point.It should be a number [0,1] corresponding to
     *         the linear distribution [minDIameter, maxDiameter] so that 0 -> minDiameter and
     *         0.5 -> (minDiameter + maxDiameter) / 2...
     *       ~ minDiameter: number - Minimum diameter of the circle.
     *       ~ maxDiameter: number - Maximum diameter of the circle.
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
     *       ~ image: string - Executable string having in _D the point information. It should provide the url of the
     *         image to display inside the circle.
     *       ~ imageMargin: number - Margin of the image inside the circle.
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
            if(this.chartUpdate != null) {
                this.chartUpdate();
            } else {
                this.chart.update();
            }


        } else { // Paint it for first time
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

            //Calculate the size which is the area. Indeed the formula is 100 * area = PI * radius²
            var minDiameter = this.configuration.minDiameter;
            var maxDiameter = this.configuration.maxDiameter;
            var diameterScale = d3.scale.linear().domain([0,1]).range([minDiameter, maxDiameter]);
            var diameter = diameterScale(this.configuration.size(metricsGroup));
            var area = Math.pow(diameter/2, 2) * Math.PI / 100;

            var groupEntry = {
                key: label,
                color: this.configuration.color(metricsGroup),
                values: [
                    {
                        size: area,
                        shape: 'circle',
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
                .height(this.configuration.height)
                .pointDomain(this.configuration.pointDomain)
                .pointRange([this.configuration.minDiameter, this.configuration.maxDiameter])
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
                    return this.replace(this.configuration.tooltip, pointData.point);
                }.bind(this));

            } else if(typeof this.configuration.tooltip === 'function') {
                this.chart.tooltip.contentGenerator(function(pointData) {
                    return this.configuration.tooltip(pointData.point);
                }.bind(this));
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

            if(this.configuration.image != null) {

                var imgObtainer = this.replace.bind(this, this.configuration.image);

                /**
                 * This method handles all the stuff related to the images that are added to the circle. It iterates
                 * over all the "points" (all the paths) and checks if they have a g element inside. If it has a element
                 * that means that it just have to be updated, so the parent g transform attribute is copied to this g
                 * element. Otherwise, the clipPath and image elements are created.
                 */
                var handleImagesInSvg = function (isRenderEvent) {

                    var amountOfMargin = this.configuration.imageMargin * 2;
                    var minImageDiameter = this.configuration.minDiameter - amountOfMargin;
                    var maxImageDiameter = this.configuration.maxDiameter - amountOfMargin;

                    d3.select(this.svg.get(0)).selectAll("path.nv-point").each(function(pointData, i) {

                        var thisd3 = d3.select(this);
                        var parentd3 = d3.select(this.parentNode);
                        var g = parentd3.select('g');
                        var pointDiameter = Math.min(Math.max(this.getBoundingClientRect().width - amountOfMargin, minImageDiameter), maxImageDiameter);

                        if(g[0][0] == null) {

                            var point = pointData[0];
                            var imgUrl = imgObtainer(point);
                            var patternId = i + imgUrl.replace(/\W+/g, '');

                            g = parentd3.append("g");

                            g.append("clipPath")
                                .attr('id', patternId)
                                .append("circle")
                                .attr("class", "clip-path")
                                .attr("r", pointDiameter / 2);

                            g.append("svg:image")
                                .attr("class", "circle")
                                .attr("xlink:href", imgUrl)
                                .attr("clip-path","url(#" + patternId + ")")
                                .attr("x", -pointDiameter/2)
                                .attr("y", -pointDiameter/2)
                                .attr("width", pointDiameter)
                                .attr("height", pointDiameter)
                                .transition()
                                    .delay(150)
                                    .attr('opacity', 1);

                        } else { //Update dimensions

                            g.select("clipPath circle")
                                .attr("r", pointDiameter / 2);
                            g.select("image")
                                .attr("x", -pointDiameter/2)
                                .attr("y", -pointDiameter/2)
                                .attr("width", pointDiameter)
                                .attr("height", pointDiameter)
                                .transition()
                                    .attr('opacity', 1);

                        }

                        g.attr('transform', thisd3.attr("transform"));

                    });

                }.bind(this);

                var hideImagesInSvg = function() {
                    d3.select(this.svg.get(0)).selectAll("path.nv-point").each(function() {

                        d3.select(this.parentNode).select('g image').attr('opacity', 0);

                    });
                }.bind(this);

                
                this.chart.dispatch.on('renderEnd', handleImagesInSvg.bind(this, true));

                var prev_update = this.chart.update;
                this.chartUpdate = function() {
                    hideImagesInSvg();
                    prev_update.apply(this, arguments);
                };

            }


            nv.utils.windowResize(this.chartUpdate);

            return this.chart;
        }.bind(this));


    };

    window.framework.widgets.Scatter = Scatter;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [], function () { return Scatter; } );
    }

})();