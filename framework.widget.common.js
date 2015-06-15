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

define(['css!sdh-framework/framework.widget.common'], function() {

    // CHECK D3
    if(typeof d3 === 'undefined') {
        console.error("RangeChart could not be loaded because d3 did not exist.");
        return;
    }

	var CommonWidget = function CommonWidget(extending, container) {

		if (extending === true) {
            return;
        }

        //First of all, register this widget with the dashboard
        framework.dashboard.registerWidget(this);

        this.isloading = 0;
        this.callback = null;
        this._common = {};
        this._common.container = container;
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
            this._common.loadingLayer.removeEventListener('transitionend', this.restoreContainerHandler);
            $(this._common.container).removeClass('blurMode');
            this._common.container.style.position = oldposstyle;
            window.removeEventListener("resize", resizeHandler.bind(this));
            if (typeof this.callback == 'function') {
                this.callback();
            }
        }.bind(this);
	};

    var oldContainerClass, oldposstyle;

    CommonWidget.prototype.startLoading = function startLoading() {
        this.isloading += 1;
        if (this.isloading > 1) {
            return;
        }
        if (!oldposstyle) {
            oldposstyle = this._common.container.style.position;
        }
        this._common.container.style.position = 'relative';
        setLoadingSize.call(this);
        window.addEventListener("resize", resizeHandler.bind(this));
        $(this._common.container).addClass('blurMode');
        $(this._common.loadingLayer).addClass('on');

    };

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
        console.log(e);
    };

    /*
    The transitionend event doesn't fire if the transition is aborted before
    the transition is completed because either the element is made display: none
    or the animating property's value is changed.
    */
    CommonWidget.prototype.endLoading = function endLoading(callback) {
        this.isloading -= 1;
        if(this.isloading == 0) {
            this.callback = callback;
            this._common.loadingLayer.addEventListener('transitionend', this.restoreContainerHandler);
            setTimeout(function() {
                $(this._common.loadingLayer).removeClass('on')
            }.bind(this), 100);
        } else {
            console.log('discarding data...');
        }
    };

    CommonWidget.prototype.changeDashboard = function changeDashboard(dashboard) {

        //Ask the framework to change the dashboard
        framework.dashboard.changeTo(dashboard);
    };


	window.framework.widgets.CommonWidget = CommonWidget;

});
