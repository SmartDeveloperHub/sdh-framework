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

    var CommonWidget = function CommonWidget(extending, container) {

        if (extending === true) {
            return;
        }

        //First of all, register this widget with the dashboard
        framework.dashboard.registerWidget(this);

        this._common = {};
        this._common.isloading = 0;
        this._common.callback = null;
        this._common.secureEndTimer = null;
        this._common.previousColors = {};
        this._common.disposed = false;
        this._common.container = container;
        this._common.resizeHandler = null;

        this._common.loadingContainer = document.createElement('div');
        this._common.loadingContainer.className ='loadingContainer';
        var loadingLayer = document.createElement('div');
        loadingLayer.className ='loadingLayer';
        var spinner = document.createElement('i');
        spinner.className ='fa fa-spinner fa-pulse';

        this._common.loadingContainer.appendChild(loadingLayer);
        loadingLayer.appendChild(spinner);
        this._common.container.appendChild(this._common.loadingContainer);
        this._common.loadingLayer = loadingLayer;

        this.restoreContainerHandler = function restoreContainerHandler(e) {
            clearTimeout(this._common.secureEndTimer);
            this._common.loadingLayer.removeEventListener('transitionend', this.restoreContainerHandler);
            $(this._common.container).removeClass('blurMode');
            this._common.container.style.position = oldposstyle;
            window.removeEventListener("resize", this._common.resizeHandler);
            this._common.resizeHandler = null;
            if (typeof this._common.callback == 'function' && !this._common.disposed) {
                this._common.callback();
            }
        }.bind(this);
    };

    var oldContainerClass, oldposstyle;

    CommonWidget.prototype.startLoading = function startLoading() {
        this._common.isloading += 1;
        if (this._common.isloading > 1) {
            return;
        }
        if (!oldposstyle) {
            oldposstyle = this._common.container.style.position;
        }
        this._common.container.style.position = 'relative';
        setLoadingSize.call(this);
        this._common.resizeHandler = resizeHandler.bind(this);
        window.addEventListener("resize", this._common.resizeHandler);
        $(this._common.container).addClass('blurMode');
        $(this._common.loadingLayer).addClass('on');

    };

    /*
    The transitionend event doesn't fire if the transition is aborted before
    the transition is completed because either the element is made display: none
    or the animating property's value is changed.
    */
    CommonWidget.prototype.endLoading = function endLoading(callback) {
        this._common.isloading -= 1;
        if(this._common.isloading == 0) {
            this._common.callback = callback;
            this._common.loadingLayer.addEventListener('transitionend', this.restoreContainerHandler);
            setTimeout(function() {
                $(this._common.loadingLayer).removeClass('on')
            }.bind(this), 100);
            this._common.secureEndTimer = setTimeout(function() {
                this.restoreContainerHandler();
            }.bind(this), 600);
        } else {
            console.log('discarding data...');
        }
    };

    CommonWidget.prototype.extractMetrics = function extractMetrics(framework_data) {

        var values = [];

        for(var metricId in framework_data) {

            for(var m = 0; m < framework_data[metricId].length; ++m) {

                var metricData = framework_data[metricId][m]['data'];

                if(typeof metricData === 'object' && metricData['values'] != null) {
                    for(var k = 0; k < metricData['values'].length; k++) {
                        values.push(metricData['values'][k]);
                    }
                }

            }
        }

        return values;

    };

    CommonWidget.prototype.extractData = function extractData(framework_data) {

        var values = [];

        for(var metricId in framework_data) {

            for(var m = 0; m < framework_data[metricId].length; ++m) {

                var metricData = framework_data[metricId][m]['data'];

                if(metricData instanceof Array) {
                    for(var k = 0; k < metricData.length; k++) {
                        values.push(metricData[k]);
                    }
                } else if(typeof metricData === 'object' && metricData['values'] == null) {
                    values.push(metricData);
                }

            }
        }

        return values;

    };

    CommonWidget.prototype.extractAll = function extractAll(framework_data) {

        return [].concat(this.extractData(framework_data), this.extractMetrics(framework_data));
    };

    var inArray = function inArray(str, array) {
        for(var c = 0; c < array.length; ++c) {
            if(array[c] === str) {
                return true;
            }
        }

        return false;
    };

    CommonWidget.prototype.generateColors = function generateColors(framework_data, palette) {

        var newPreviousColors = {};
        palette = palette || d3.scale.category20().range();

        var colors = [];
        var usedColorIndexes = {};
        for(var id in this._common.previousColors){
            usedColorIndexes[this._common.previousColors[id]] = true;
        }

        var currentColorIndex = -1;

        for(var metricId in framework_data) {

            for (var m = 0; m < framework_data[metricId].length; ++m) {

                var UID = framework_data[metricId][m]['info']['UID'];

                if(this._common.previousColors[UID] != null && newPreviousColors[UID] == null) { //Use the previous color
                    colors.push(palette[this._common.previousColors[UID] % palette.length]);
                    newPreviousColors[UID] = this._common.previousColors[UID];

                } else { //Try to assign an unused color

                    while(true) {

                        if(!usedColorIndexes[++currentColorIndex]) {
                            colors.push(palette[currentColorIndex % palette.length]);
                            newPreviousColors[UID] = currentColorIndex;
                            break;
                        }

                    }

                }


            }

        }

        this._common.previousColors = newPreviousColors;

        return colors;

    };

    /**
     * Generic observe methods that should be used in the widget as it controls concurrency problems.
     * When new data is received, the updateData method is called.
     * @param event
     */
    CommonWidget.prototype.commonObserveCallback = function commonObserveCallback(event) {

        if(this._common.disposed) {
            return;
        }

        if(event.event === 'loading') {
            this.startLoading();
        } else if(event.event === 'data') {

            //Check if there is any metric that needs to be filled with zeros
            for(var resourceId in event.data) {
                for(var i in event.data[resourceId]){
                    var resource = event.data[resourceId][i];

                    //Only metrics need to be checked
                    if(isMetric(resource)) {
                        zeroFillMetric(resource);
                    }
                }
            }

            this.endLoading(this.updateData.bind(this, event.data));
        }

    };

    /**
     * Sets the widget as disposed.
     * @param event
     */
    CommonWidget.prototype.dispose = function dispose() {
        this._common.disposed = true;
    };


    // ---------------------------
    // ------PRIVATE METHODS------
    // ---------------------------

    var setLoadingSize = function setLoadingSize() {
        var wsize = this._common.container.getBoundingClientRect();
        // center the spinner vertically because a responsive
        // widget can change it height dynamically
        this._common.loadingLayer.style.lineHeight = wsize.height + 'px';
        this._common.loadingContainer.style.height = wsize.height + 'px';
        this._common.loadingContainer.style.width = wsize.width + 'px';
        if(this._common.loadingContainer.getBoundingClientRect().top == 0) {
            this._common.loadingContainer.style.top = wsize.top + 'px';
        }
        this._common.loadingContainer.style.left = 'auto';
    };

    var resizeHandler = function resizeHandler(e) {
        setLoadingSize.call(this);
    };

    var isNumber = function isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    };

    var isMetric = function isMetric(resource) {
        var resourceData = resource.data;
        return resourceData != null && resourceData.values instanceof Array && isNumber(resourceData.values[0]);
    };

    var zeroFillMetric = function zeroFillMetric(resource) {

        var resourceInterval = resource['data']['interval'];
        var requestedInterval = {
            from: resource['info']['request']['params']['from'],
            to: resource['info']['request']['params']['to']
        };

        var step = resource['data']['step'];
        var values = resource['data']['values'];

        //We need step to be a number
        if(!isNumber(step)){
            return;
        }
        step = Number(step);

        // Check 'from'
        if(resourceInterval['from'] != null && requestedInterval['from'] != null) {

            //Make sure they are numbers
            resourceInterval['from'] = Number(resourceInterval['from']);
            requestedInterval['from'] = Number(requestedInterval['from']);

            // We need to add zeros
            if(requestedInterval['from'] < resourceInterval['from']) {
                var diff = resourceInterval['from'] - requestedInterval['from'];
                var nZeros = Math.floor(diff/step);

                //Add the calculated number of zeros
                for(var i = nZeros; i > 0; --i) {
                    values.unshift(0);
                }

                //Update the new from
                resourceInterval['from'] -= nZeros * step;
            }

        }

        // Check 'to'
        if(resourceInterval['to'] != null && requestedInterval['to'] != null) {

            //Make sure they are numbers
            resourceInterval['to'] = Number(resourceInterval['to']);
            requestedInterval['to'] = Number(requestedInterval['to']);

            // We need to add zeros
            if(requestedInterval['to'] > resourceInterval['to']) {
                var diff = requestedInterval['to'] - resourceInterval['to'];
                var nZeros = Math.floor(diff/step);

                //Add the calculated number of zeros
                for(var i = nZeros; i > 0; --i) {
                    values.push(0);
                }

                //Update the new from
                resourceInterval['from'] += nZeros * step;
            }

        }


    };


    window.framework.widgets.CommonWidget = CommonWidget;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( ['css!sdh-framework/framework.widget.common'], function () { return CommonWidget; } );
    }

})();