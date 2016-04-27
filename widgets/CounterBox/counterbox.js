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

            if (typeof configuration.label !== "string") {
                configuration.label = true;
            }

            if (typeof configuration.icon !== "string") {
                configuration.icon = "octicon octicon-octoface";
            }

            if (typeof configuration.iconcolor !== "string") {
                configuration.iconcolor = "#FFF";
            }

            if (typeof configuration.labelcolor !== "string") {
                configuration.testcolor = "rgba(0, 0, 0, 0.7)";
            }

            if (typeof configuration.countercolor !== "string") {
                configuration.testcolor = "#000";
            }

            if (typeof configuration.decimals !== "number") {
                configuration.decimals = 2;
            }

            if (typeof configuration.suffix !== "string") {
                configuration.suffix = "";
            }

            if (typeof configuration.prefix !== "string") {
                configuration.prefix = "";
            }
            return configuration;
        };

        /* CounterBox constructor
        *   element: the DOM element that will contains the CounterBox div
        *   data: the data id array
        *   contextId: if necesary, the contextId link this chart data data
        *           with changes in other context provider chart.
        *  configuration: you can use his optional parameter to assing a custom
        *       contextID for this context provider chart. Ej:
        *      {
        *         label: label text,
        *         labelcolor: label text color,
        *         countercolor: color of the number,
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
        var CounterBox = function CounterBox(element, metrics, contextId, configuration) {

            if(!framework.isReady()) {
                console.error("CounterBox object could not be created because framework is not loaded.");
                return;
            }

            this.element = $(element);

            this.configuration = normalizeConfig(configuration);

            this.data = null;
            this.decimal = this.configuration.decimal;
            this.currentValue = 0;
            this.deleted = false;

            // container
            this.container = document.createElement('div');
            this.container.className = "com-widget com-counter";
            this.container.setAttribute("data-easing", this.configuration.changeeasing);
            this.container.style.background = this.configuration.background;
            // icon
            this.icon = document.createElement('div');
            this.icon.className = "com-icon blurable";
            var ico = document.createElement('i');
            ico.className = this.configuration.icon;
            ico.style.background = this.configuration.iconbackground;
            ico.style.color = this.configuration.iconcolor;
            this.icon.appendChild(ico);
            this.container.appendChild(this.icon);
            // value
            this.label = document.createElement('div');
            this.label.className = "com-label blurable";
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
            this.container.appendChild(this.label);

            element.appendChild(this.container);

            // extending widget
            framework.widgets.CommonWidget.call(this, false, element);

            this.observeCallback = this.commonObserveCallback.bind(this);

            framework.data.observe(metrics, this.observeCallback , contextId, 1);

        };

        CounterBox.prototype = new framework.widgets.CommonWidget(true);

        CounterBox.prototype.updateData = function(data) {

            // If it has been deleted, don't do nothing
            if(this.deleted)
                return;

            var resourceId = Object.keys(data)[0];
            var resourceUID = Object.keys(data[resourceId])[0];
            this.data = data[resourceId][resourceUID]['data'];

            var options = {
                useEasing : this.configuration.changeeasing,
                useGrouping : true,
                separator : '.',
                decimals : this.decimals,
                decimal : ',',
                prefix : this.configuration.prefix ,
                suffix : this.configuration.suffix
            };

            var cntr = new countUp(this.labn, this.currentValue, this.data.values[0], this.configuration.decimal, this.configuration.changetime, options);
            this.currentValue = this.data.values[0];
            cntr.start();

        };

        CounterBox.prototype.delete = function() {

            // If it has been delete, don't do nothing
            if(this.deleted)
                return;

            this.deleted = true;

            //Stop observing for data changes
            framework.data.stopObserve(this.observeCallback);

            //Clear DOM
            $(this.container).empty();
            this.element.empty();

        };

        /* Count It Up */
        function countUp(a,b,c,d,e,f){for(var g=0,h=["webkit","moz","ms","o"],i=0;i<h.length&&!window.requestAnimationFrame;++i)window.requestAnimationFrame=window[h[i]+"RequestAnimationFrame"],window.cancelAnimationFrame=window[h[i]+"CancelAnimationFrame"]||window[h[i]+"CancelRequestAnimationFrame"];window.requestAnimationFrame||(window.requestAnimationFrame=function(a){var c=(new Date).getTime(),d=Math.max(0,16-(c-g)),e=window.setTimeout(function(){a(c+d)},d);return g=c+d,e}),window.cancelAnimationFrame||(window.cancelAnimationFrame=function(a){clearTimeout(a)}),this.options=f||{useEasing:!0,useGrouping:!0,separator:",",decimal:"."},""==this.options.separator&&(this.options.useGrouping=!1),null==this.options.prefix&&(this.options.prefix=""),null==this.options.suffix&&(this.options.suffix="");var j=this;this.d="string"==typeof a?document.getElementById(a):a,this.startVal=Number(b),this.endVal=Number(c),this.countDown=this.startVal>this.endVal?!0:!1,this.startTime=null,this.timestamp=null,this.remaining=null,this.frameVal=this.startVal,this.rAF=null,this.decimals=Math.max(0,d||0),this.dec=Math.pow(10,this.decimals),this.duration=1e3*e||2e3,this.version=function(){return"1.3.1"},this.printValue=function(a){var b=isNaN(a)?"--":j.formatNumber(a);"INPUT"==j.d.tagName?this.d.value=b:this.d.innerHTML=b},this.easeOutExpo=function(a,b,c,d){return 1024*c*(-Math.pow(2,-10*a/d)+1)/1023+b},this.count=function(a){null===j.startTime&&(j.startTime=a),j.timestamp=a;var b=a-j.startTime;if(j.remaining=j.duration-b,j.options.useEasing)if(j.countDown){var c=j.easeOutExpo(b,0,j.startVal-j.endVal,j.duration);j.frameVal=j.startVal-c}else j.frameVal=j.easeOutExpo(b,j.startVal,j.endVal-j.startVal,j.duration);else if(j.countDown){var c=(j.startVal-j.endVal)*(b/j.duration);j.frameVal=j.startVal-c}else j.frameVal=j.startVal+(j.endVal-j.startVal)*(b/j.duration);j.frameVal=j.countDown?j.frameVal<j.endVal?j.endVal:j.frameVal:j.frameVal>j.endVal?j.endVal:j.frameVal,j.frameVal=Math.round(j.frameVal*j.dec)/j.dec,j.printValue(j.frameVal),b<j.duration?j.rAF=requestAnimationFrame(j.count):null!=j.callback&&j.callback()},this.start=function(a){return j.callback=a,isNaN(j.endVal)||isNaN(j.startVal)?(console.log("countUp error: startVal or endVal is not a number"),j.printValue()):j.rAF=requestAnimationFrame(j.count),!1},this.stop=function(){cancelAnimationFrame(j.rAF)},this.reset=function(){j.startTime=null,j.startVal=b,cancelAnimationFrame(j.rAF),j.printValue(j.startVal)},this.resume=function(){j.stop(),j.startTime=null,j.duration=j.remaining,j.startVal=j.frameVal,requestAnimationFrame(j.count)},this.formatNumber=function(a){a=a.toFixed(j.decimals),a+="";var b,c,d,e;if(b=a.split("."),c=b[0],d=b.length>1?j.options.decimal+b[1]:"",e=/(\d+)(\d{3})/,j.options.useGrouping)for(;e.test(c);)c=c.replace(e,"$1"+j.options.separator+"$2");return j.options.prefix+c+d+j.options.suffix},j.printValue(j.startVal)}

        window.framework.widgets.CounterBox = CounterBox;
        return CounterBox;

    });

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [
            'sdh-framework/widgets/Common/common'
        ], function () {
            return __loader();
        } );
    } else {
        __loader();
    }

})();