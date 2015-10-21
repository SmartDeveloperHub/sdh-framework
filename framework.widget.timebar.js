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
            default: 100
        },
        color: {
            type: ['function', 'object'],
            default: function() { return "#000000"; }
        }
    };

    /* TimeBar constructor
     *   element: the DOM element that will contain the widget
     *   resources: resources to observe
     *   contexts: list of contexts
     *   configuration: custom widget configuration.
     */
    var TimeBar = function TimeBar(element, resources, contexts, configuration) {

        this.element = $(element); //Store as jquery object

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

        var data = getNormalizedData(framework_data);

        // Remove previous container
        this.element.find(".timebar-container").remove();

        // Add new bar
        this.element.append('<div class="timebar-container"><div class="progress" style="height: ' + this.configuration.height + 'px"></div></div>');
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

        var width = 100 / data.values.length;
        var timeIncremental = (data.interval.to - data.interval.from) / data.values.length;

        // Create all the chunks of the bar
        for(var i = 0; i < data.values.length; ++i) {
            var color = colorFunction(data.values[i]);
            var time = data.interval.from + i * timeIncremental;
            progress.append($('<div class="progress-bar" title="'+ time +'" ' +'style="width: ' + width + '%; background-color: ' + color + '"></div>')
                    .tooltip({
                        html: true
                    })
            );
        }

        //Add labels
        var container = this.element.find(".timebar-container");
        var timeFormat = d3.time.format("%Y-%m-%d");
        var xAxis = $('<div class="timebar-x-axis"></div>')
            .append($('<span>' + timeFormat(new Date(data.interval.from)) + '</span>')
                .css('position', 'absolute')
                .css('margin', '5px')
                .css('left', 0)
            )
            .append($('<span>' + timeFormat(new Date(data.interval.to)) + '</span>')
                .css('position', 'absolute')
                .css('margin', '5px')
                .css('right', 0)
            );
        container.append(xAxis);


    };

    TimeBar.prototype.delete = function() {

        // Stop observing for data changes
        framework.data.stopObserve(this.observeCallback);

        this.element.remove(".progress");

    };


    var getNormalizedData = function getNormalizedData(framework_data) {

        /* //TODO: uncomment for real data
        var resourceId = Object.keys(framework_data)[0];
        var resourceUID = Object.keys(framework_data[resourceId])[0];
        var resource = framework_data[resourceId][resourceUID];

        return {
            values: resource['data']['values'],
            interval: resource['data']['interval']
        };
        */


        var values = [0];
        var changeDiff = 0.01;
        var change = changeDiff;
        for(var i = 1; i < 1000; i++) {

            if(change === 0 && Math.random() > 0.95) {
                if(values[i-1] === 0) {
                    change = changeDiff;
                } else {
                    change = -changeDiff;
                }
            }

            values[i] = Math.max(0, Math.min(values[i-1] + change, 1));
            if(values[i] === 0 || values[i] === 1) {
                change = 0;
            }
        }

        return {
            values: values,
            interval: {
                from: 1445327267726,
                to: 1445427267726
            }
        };

    };

    // Register the widget in the framework
    window.framework.widgets.TimeBar = TimeBar;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [ /* List of dependencies */ ], function () { return TimeBar; } );
    }

})();