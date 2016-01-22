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

        var defaultConfig = {
            height: {
                type: ['number'],
                default: 100
            },
            color: {
                type: ['function', 'object'],
                default: function() { return "#000000"; }
            },
            tooltip: {
                type: ['string', 'function'],
                default: null
            },
            legend: {
                type: [Array],
                default: []
            },
            showMaxMin: {
                type: ['boolean'],
                default: false
            }
        };

        /* TimeBar constructor
         *   element: the DOM element that will contain the widget
         *   resources: resources to observe
         *   contexts: list of contexts
         *   configuration: additional chart configuration:
         *      {
         *       ~ height: number - Height of the widget.
         *       ~ color: function - Function to decide the color of the point.
         *       ~ tooltip: string - Format string for the tooltip. Metric parameters can be used as variables by
         *         surrounding their names with the symbol '¬'. Metrics data can be accessed with _D. For example,
         *         the following is a valid labelFormat: "Repository: ¬_D.repocommits.info.rid.name¬".
         *         You can also access extra elements like ¬_E.value¬ and ¬_E.time¬
         *      }
         */
        var TimeBar = function TimeBar(element, resources, contexts, configuration) {

            this.element = $(element); //Store as jquery object
            this.status = 0; // 0 - not initialized, 1 - ready, 2 - destroyed

            // Extending widget
            framework.widgets.CommonWidget.call(this, false, element);

            // Configuration
            this.configuration = this.normalizeConfig(defaultConfig, configuration);

            // Use the callback offered by widget.common
            this.observeCallback = this.commonObserveCallback.bind(this);

            framework.data.observe(resources, this.observeCallback, contexts);

        };

        TimeBar.prototype = new framework.widgets.CommonWidget(true);

        TimeBar.prototype.updateData = function(framework_data) {

            // Has been destroyed
            if(this.status === 2)
                return;

            var normalizedData = getNormalizedData.call(this,framework_data);

            paint.call(this, normalizedData, framework_data);


        };

        TimeBar.prototype.delete = function() {

            // Has already been destroyed
            if(this.status === 2)
                return;

            // Stop observing for data changes
            framework.data.stopObserve(this.observeCallback);

            if(this.chartUpdate != null) {
                $(window).off("resize", this.chartUpdate);
            }

            this.element.remove(".timebar-container");

            //Update status
            this.status = 2;

        };


        var getNormalizedData = function getNormalizedData(framework_data) {

            var resourceId = Object.keys(framework_data)[0];
            var resourceUID = Object.keys(framework_data[resourceId])[0];
            var resource = framework_data[resourceId][resourceUID];

            return {
                values: resource['data']['values'],
                interval: resource['data']['interval'],
                step: resource['data']['step']
            };

        };

        var paint = function(data, framework_data) {

            // Remove previous container
            this.element.find(".timebar-container").remove();

            // Add new bar
            this.element.append('<div class="timebar-container blurable">' +
                    '<div class="progress" style="height: ' + this.configuration.height + 'px"></div>' +
                    '<svg class="axis nvd3"></svg>' +
                '</div>');
            var progress = this.element.find(".progress");


            // Select the color function (an user given function or an object based function)
            var colorFunction = null;
            if(typeof this.configuration.color === 'function') {
                colorFunction = this.configuration.color;
            } else {
                colorFunction = function(val) {
                    return this.configuration.color[String(val)];
                }.bind(this);
            }


            // Create legend
            if(this.configuration.legend != null && this.configuration.legend.length > 1) {

                var legend = $('<div></div>')
                    .addClass('timebar-legend');

                legend.append('<span class="legend-label">'+ this.configuration.legend[0] +'</span>');

                var legendGradient = $('<div></div>')
                    .css('background', 'linear-gradient(to left, '+colorFunction(0)+' , '+colorFunction(0.5)+' ,'+colorFunction(1)+')')
                    .addClass('legend-gradient');

                legend.append(legendGradient);

                legend.append('<span class="legend-label">'+ this.configuration.legend[1] +'</span>');

                this.element.find(".timebar-container").prepend(legend);

            }

            // Create axis
            var axisSvg = this.element.find("svg.axis");
            axisSvg.css('height', '25px');

            var availableWidth = this.element.find(".progress").width();

            var axis = nv.models.axis()
                .showMaxMin(this.configuration.showMaxMin)
                .height(25)
                .scale(d3.time.scale.utc()
                    .domain([data.interval.from, data.interval.to])
                    .range([0, availableWidth]))
                    .ticks(Math.round(availableWidth / 200)
                )
                .width(availableWidth)
                .tickFormat(this.format.date);

            d3.select(axisSvg.get(0))
                .call(axis);

            var width = 100 / data.values.length;

            // Create all the chunks of the bar
            for(var i = 0; i < data.values.length; ++i) {
                var color = colorFunction(data.values[i]);
                var content = null;

                //We need to distribute the time of the step among all the "segments" of data so that the first
                // value's date corresponds to the "from" date of the interval and the last value's date corresponds
                // to the "to" date of the interval minus 1 second.
                var distributedStep = i * (data.step - 1) / (data.values.length - 1);

                var time = data.interval.from + i * data.step + distributedStep;

                //Configure how the tooltip looks.
                if(typeof this.configuration.tooltip === 'string') {
                    content = this.replace(this.configuration.tooltip, framework_data, { value: data.values[i], time: time } );
                } else if(typeof this.configuration.tooltip === 'function') {
                    content = this.configuration.tooltip( { value: data.values[i], time: time } );
                }

                addBarToProgressBar(progress, width, color, content);

            }

            // Set the chart as ready
            this.status = 1;

        };

        var addBarToProgressBar = function (progress, width, color, content) {
            var bar = $('<div class="progress-bar" style="width: ' + width + '%; background-color: ' + color + '"></div>')
                .qtip({
                    content: function() {
                        return content;
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

            progress.append(bar);
        };

        window.framework.widgets.TimeBar = TimeBar;
        return TimeBar;

    });

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [
            'widgetCommon',
            'nvd3',
            'jquery-qtip',
            'css!vendor/bootstrap/dist/css/bootstrap.min.css',
            'css!vendor/sdh-framework/framework.widget.timebar.css',
            'css!vendor/qtip2/jquery.qtip.min.css'
        ], function () {
            return __loader();
        } );
    } else {
        __loader();
    }

})();