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

    //Constants
    var ONE_DAY_MS = 86400000;
    var ONE_WEEK_MS = 604800000;
    var PAINT_DELAY_MS = 1000;

    // Configuration checker
    var normalizeConfig = function normalizeConfig(configuration) {

        if (configuration == null) {
            configuration = {};
        }

        if(!(configuration['colors'] instanceof Array)) {
            configuration['colors'] = ['#F6FAAA','#FEE08B','#FDAE61','#F46D43','#D53E4F','#9E0142'];
        }

        return configuration;
    };

    // BASIC METHODS - - - - - - - - - - - - - - - - - - - - - -

    var Heatmap = function Heatmap(element, metrics, contextId, configuration) {

        if(!framework.isReady()) {
            console.error("Heatmap object could not be created because framework is not loaded.");
            return;
        }

        // CHECK D3
        if(typeof d3 === 'undefined') {
            console.error("Heatmap could not be loaded because d3 did not exist.");
            return;
        }

        if(metrics.length > 1) {
            metrics = metrics.splice(1, metrics.length-1);
            console.warn("This widget only allows one metric. The other metrics will be ignored.");
        }

        this.element = $(element); //Store as jquery object
        this.svg = null;
        this.data = null;
        this.aspect = null;
        this.resizeEventHandler = null;
        this.painted = false;
        this.metricId = metrics[0]['id'];
        this.maxValue = -1;
        this.minValue = Infinity;

        // Extending widget
        framework.widgets.CommonWidget.call(this, false, this.element.get(0));

        // Configuration
        this.configuration = normalizeConfig(configuration);

        this.observeCallback = function(event){

            if(event.event === 'loading') {
                this.startLoading();
            } else if(event.event === 'data') {
                this.endLoading(this.updateData.bind(this, event.data));
            }

        }.bind(this);

        framework.data.observe(metrics, this.observeCallback , contextId);

    };

    Heatmap.prototype = new framework.widgets.CommonWidget(true);

    Heatmap.prototype.updateData = function(data) {

        if(this.painted) {
            //Clear DOM
            this.svg.empty();
            this.element.find('svg').remove();
            this.svg = null;
            this.painted = false;
        }

        var metricUID = Object.keys(this.metricId)[0];
        this.data = data[this.metricId][metricUID]['data'];
        paint.call(this);
    };

    Heatmap.prototype.delete = function() {

        if(!this.painted)
            return;

        //Stop listening to window resize events
        $(window).off("resize", this.resizeEventHandler);
        this.resizeEventHandler = null;

        //Stop observing for data changes
        framework.data.stopObserve(this.observeCallback);

        //Clear DOM
        this.svg.empty();
        this.element.find('svg').remove();
        this.svg = null;

        this.painted = false;

    };


    // PRIVATE METHODS - - - - - - - - - - - - - - - - - - - - - -

    var updateSize = function updateSize() {

        var parentWidth = this.svg.parent().get(0).getBoundingClientRect().width;
        var parentHeight = this.svg.parent().get(0).getBoundingClientRect().height;
        var parentAspect = parentWidth / parentHeight;
        if(parentAspect <= this.aspect){
            this.svg.attr('width', parentWidth);
            this.svg.attr('height', parentWidth / this.aspect);
        } else {
            this.svg.attr('width', parentHeight * this.aspect);
            this.svg.attr('height', parentHeight);
        }
    };

    var renderColor = function renderColor(rect, dateExtent){

        rect
            .filter(function(value){
                return value >= 0;
            })
            .transition()
            .delay(function(d, index){
                var max = dateExtent[1].getTime();
                var min = dateExtent[0].getTime();
                var current = dateExtent[0].getTime() + index * this.data['step'];
                return PAINT_DELAY_MS * (current - min)/(max - min);
            }.bind(this))
            .duration(500)
            .attrTween('fill',function(value,i,a){
                //choose color dynamically
                var colorIndex = d3.scale.quantize()
                    .range(d3.range(0, this.configuration['colors'].length, 1))
                    .domain([this.minValue, this.maxValue]);
                return d3.interpolate(a, this.configuration['colors'][colorIndex(value)]);
            }.bind(this));
    };

    var paint = function paint() {

        if(this.data == null) {
            return; // Nothing to paint
        }

        if(this.painted) {
            this.updateSize();
            return;
        }

        // Add an svg element to draw in it
        this.element.append('<svg role="heatmap" class="heatmap blurable" preserveAspectRatio="xMidYMid"></svg>');
        this.svg = this.element.children("svg");

        // Metric values
        var dataValues = this.data['values'];

        //UI configuration
        var itemSize = 18,
            cellSize = itemSize-1,
            width = this.element.width(),
            height = this.element.height(),
            margin = {top:20,right:20,bottom:20,left:40};

        //formats
        var dateFormat = d3.time.format('%m/%d/%Y'),
            monthNameFormat = d3.time.format('%b'),
            weekDayFormat = d3.time.format("%w");

        //axises and scales
        var axisWidth = 0 ,
            axisHeight = itemSize*7,
            xAxisScale = d3.time.scale(),
            yAxisScale = d3.scale.linear(),
            xAxis = d3.svg.axis()
                .orient('top')
                .ticks(d3.time.months,1)
                .tickFormat(monthNameFormat),
            weekDayNames = ["Sun", "Mon", "Tues", "Wed", "Thurs", "Fri", "Sat"];
        yAxis = d3.svg.axis()
            .orient('left')
            .ticks(7)
            .tickFormat(function(d, i){
                return weekDayNames[d];
            });

        var d3svg = d3.select(this.svg.get(0));
        var heatmap = d3svg
            .attr('width',width)
            .attr('height',height)
            .style('max-height', height)
            .append('g')
            .attr('width',width-margin.left-margin.right)
            .attr('height',height-margin.top-margin.bottom)
            .attr('class','heatmap-content')
            .attr('transform','translate('+margin.left+','+margin.top+')');

        var rect = null;
        var dailyValues = [];

        //Create a date extent object with the from and to dates
        var dateExtent = [new Date(this.data['interval']['from']), new Date(this.data['interval']['to'])];

        //Clean the from date to start from midnight
        var firstDay = new Date(dateExtent[0]);
        firstDay.setHours(0);
        firstDay.setMinutes(0);
        firstDay.setMilliseconds(0);

        dataValues.forEach(function(value,index){

            //Given the data index and the from date, calculate the current date
            var curDate = dateExtent[0].getTime() + index * this.data['step'];

            //How many days has been since the from date
            var day = Math.floor((curDate - firstDay) / ONE_DAY_MS);

            //Increment the value for that day
            dailyValues[day] = (dailyValues[day] != null ? dailyValues[day] + value : value);

        }.bind(this));

        this.maxValue = -1;
        this.minValue = Infinity;

        //Get the min and max values (to create later the color scale)
        dailyValues.forEach(function(value){
            this.minValue = d3.min([this.minValue, value]);
            this.maxValue = d3.max([this.maxValue, value]);
        }.bind(this));

        //Number of weeks to be displayed in the chart
        var numWeeks = Math.ceil((dateExtent[1] - dateExtent[0] + weekDayFormat(dateExtent[0]) * ONE_DAY_MS) / ONE_WEEK_MS);

        axisWidth = itemSize * numWeeks; //53 weeks in a year

        //render axises
        xAxis.scale(xAxisScale.range([0,axisWidth]).domain([dateExtent[0],dateExtent[1]]));
        yAxis.scale(yAxisScale.range([0,axisHeight]).domain([0,6]));

        d3svg.append('g')
            .attr('transform','translate('+margin.left+','+margin.top+')')
            .attr('class','x axis')
            .call(xAxis);
        d3svg.append('g')
            .attr('transform','translate('+margin.left+','+margin.top+')')
            .attr('class','y axis')
            .call(yAxis);

        //render heatmap rects
        rect = heatmap.selectAll('rect')
            .data(dailyValues)
            .enter().append('rect')
            .attr('width',cellSize)
            .attr('height',cellSize)
            .attr('x',function(d,index){
                var curDate = dateExtent[0].getTime() + index * ONE_DAY_MS;
                return itemSize * Math.floor((curDate - firstDay + weekDayFormat(firstDay) * ONE_DAY_MS) / ONE_WEEK_MS);
            })
            .attr('y',function(d,index){
                var curDate = dateExtent[0].getTime() + index * ONE_DAY_MS;
                return weekDayFormat(new Date(curDate))*itemSize;
            })
            .attr('fill','#ffffff');

        rect.filter(function(value){ return value>0;})
            .append('title')
            .text(function(value, index){
                var curDate = dateExtent[0].getTime() + index * ONE_DAY_MS;
                return dateFormat(new Date(curDate))+': '+value;
            });

        renderColor.call(this, rect, dateExtent);

        var chartWidth = numWeeks * itemSize + margin.left + margin.right;
        var chartHeight = 7 * itemSize + margin.top + margin.bottom;
        d3svg.attr('viewBox', '0 0 '+chartWidth+' '+chartHeight);
        this.aspect = chartWidth / chartHeight;

        this.resizeEventHandler = updateSize.bind(this);
        $(window).resize(this.resizeEventHandler);

        updateSize.call(this);

        this.painted = true;

    };

    window.framework.widgets.Heatmap = Heatmap;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( ['css!sdh-framework/framework.widget.heatmap'], function () { return Heatmap; });
    }

})();