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
      contributors: Alejandro Vera (alejandro.vera@centeropenmiddleware.com ),
                    Carlos Blanco. (carlos.blanco@centeropenmiddleware.com)
    #-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=#
*/

define(['sdh-framework/framework.widget.common'], function() {

    // CHECK D3
    if(typeof d3 === 'undefined') {
        console.error("CounterBox could not be loaded because d3 did not exist.");
        return;
    }

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

    /* BigCounterBox constructor
    *   element: the DOM element that will contains the BigCounterBox div
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
    var BigCounterBox = function BigCounterBox(element, metrics, contextId, configuration) {

        if(!framework.isReady()) {
            console.error("BigCounterBox object could not be created because framework is not loaded.");
            return;
        }
        this.element = $(element);

        this.configuration = normalizeConfig(configuration);

        this.data1 = null;
        this.data2 = null;
        this.currentValue1 = 0;
        this.currentValue2 = 0;
        // container
        this.container = document.createElement('div');
        this.container.className = "com-widget com-counter";
        this.container.style.background = this.configuration.background;

        // upper container
        this.upperCont = document.createElement('div');
        this.upperCont.className = "com-upper blurable";
        this.container.appendChild(this.upperCont);
        // icon
        this.icon = document.createElement('div');
        this.icon.className = "com-icon";
        var ico = document.createElement('i');
        ico.className = this.configuration.icon;
        ico.style.background = this.configuration.iconbackground;
        ico.style.color = this.configuration.iconcolor;
        this.icon.appendChild(ico);
        this.upperCont.appendChild(this.icon);
        // value
        this.label = document.createElement('div');
        this.label.className = "com-label";
        this.labn = document.createElement('strong');
        this.labn.className = "num";
        this.labn.style.color = this.configuration.countercolor;
        this.labn.innerHTML = this.configuration.initfrom;
        this.label.appendChild(this.labn);
        // label
        var labt = document.createElement('span');
        labt.innerHTML = this.configuration.label;
        labt.style.color = this.configuration.labelcolor;
        this.label.appendChild(labt);
        this.upperCont.appendChild(this.label);

        // lower container
        this.lowerCont = document.createElement('div');
        this.lowerCont.className = "com-lower blurable";
        this.container.appendChild(this.lowerCont);
        // border
        var border = document.createElement('div');
        border.className = "border";
        this.lowerCont.appendChild(border);
        // value
        var label = document.createElement('span');
        label.innerHTML = this.configuration.label2;
        label.style.color = this.configuration.label2color;
        this.labn2 = document.createElement('strong');
        this.labn2.className = "num";
        this.labn2.style.color = this.configuration.counter2color;
        this.labn2.innerHTML = this.configuration.initfrom;
        label.appendChild(this.labn2);
        this.lowerCont.appendChild(label);

        element.appendChild(this.container);

        // extending widget
        framework.widgets.CommonWidget.call(this, false, element);

        this.observeCallback = function(event){
            if(event.event === 'loading') {
                this.startLoading();
            } else if(event.event === 'data') {
                this.eventData = event.data;
                this.endLoading(this.updateData);
            }

        }.bind(this);

        framework.data.observe(metrics, this.observeCallback , contextId, 1);

    };

    BigCounterBox.prototype = new framework.widgets.CommonWidget(true);

    BigCounterBox.prototype.updateData = function() {
        //Get first two values
        var values = function(framework_data) {
            var values = [];

            for(var metricId in framework_data) {

                for(var m in framework_data[metricId]) {

                    for(var i in framework_data[metricId][m]['values']) {
                        values.push(framework_data[metricId][m]['values'][i]);

                        if(values.length == 2) {
                            return values;
                        }
                    }
                }
            }

            console.warn("BigCounterBox needs two values. " + values.length + " values received.");
            return values;
        }.call(null, this.eventData);

        var options = {
            useEasing : this.configuration.changeeasing,
            useGrouping : true,
            separator : '.',
            decimal : '.',
            prefix : '' ,
            suffix : ''
        };

        var cntr1 = new countUp(this.labn, this.currentValue1, values[0], this.configuration.decimal, this.configuration.changetime, options);
        this.currentValue1 = values[0];
        cntr1.start();
        var cntr2 = new countUp(this.labn2, this.currentValue2, values[1], this.configuration.decimal2, this.configuration.changetime, options);
        this.currentValue2 = values[1];
        cntr2.start();
    };

    BigCounterBox.prototype.delete = function() {

        //Stop observing for data changes
        framework.data.stopObserve(this.observeCallback);

        //Clear DOM
        $(this.container).empty();
        this.element.empty();

    };

    window.framework.widgets.BigCounterBox = BigCounterBox;

});