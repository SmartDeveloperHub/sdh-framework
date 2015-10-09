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
        minValue: {
            type: ['number'],
            default: 100
        },
        circleThickness: {
            type: ['number'],
            default: 0.05
        },
        circleFillGap: {
            type: ['number'],
            default: 0.05
        },
        circleColor: {
            type: ['string'],
            default: "#178BCA"
        },
        waveHeight: {
            type: ['number'],
            default: 0.05
        },
        waveCount: {
            type: ['number'],
            default: 1
        },
        waveRiseTime: {
            type: ['number'],
            default: 1000
        },
        waveAnimateTime: {
            type: ['number'],
            default: 18000
        },
        waveRise: {
            type: ['boolean'],
            default: true
        },
        waveHeightScaling: {
            type: ['boolean'],
            default: true
        },
        waveAnimate: {
            type: ['boolean'],
            default: true
        },
        waveColor: {
            type: ['string'],
            default: "#178BCA"
        },
        waveOffset: {
            type: ['number'],
            default: 0
        },
        textVertPosition: {
            type: ['number'],
            default: 0.5
        },
        textSize: {
            type: ['number'],
            default: 1
        },
        valueCountUp: {
            type: ['boolean'],
            default: true
        },
        displayPercent: {
            type: ['boolean'],
            default: true
        },
        textColor: {
            type: ['string'],
            default: "#045681"
        },
        waveTextColor: {
            type: ['string'],
            default: "#A4DBf8"
        }
    };

    /* LiquidGauge constructor
     *   element: the DOM element that will contain the chart
     *   data: the data id array
     *   contextId: optional.
     *   configuration: additional chart configuration:
     *      {
     *       ~ minValue: 0, // The gauge minimum value.
     *       ~ maxValue: 100, // The gauge maximum value.
     *       ~ circleThickness:number - The outer circle thickness as a percentage of it's radius.
     *       ~ circleFillGap: number - The size of the gap between the outer circle and wave circle as a percentage of
     *         the outer circles radius.
     *       ~ circleColor: string - The color of the outer circle.
     *       ~ waveHeight: number - The wave height as a percentage of the radius of the wave circle.
     *       ~ waveCount: number - The number of full waves per width of the wave circle.
     *       ~ waveRiseTime:number - The amount of time in milliseconds for the wave to rise from 0 to it's final height.
     *       ~ waveAnimateTime: number - The amount of time in milliseconds for a full wave to enter the wave circle.
     *       ~ waveRise: boolean - Control if the wave should rise from 0 to it's full height, or start at it's full height.
     *       ~ waveHeightScaling: boolean - Controls wave size scaling at low and high fill percentages. When true, wave
     *         height reaches it's maximum at 50% fill, and minimum at 0% and 100% fill. This helps to prevent the wave
     *         from making the wave circle from appear totally full or empty when near it's minimum or maximum fill.
     *       ~ waveAnimate: boolean - Controls if the wave scrolls or is static.
     *       ~ waveColor: string - The color of the fill wave.
     *       ~ waveOffset: number - The amount to initially offset the wave. 0 = no offset. 1 = offset of one full wave.
     *       ~ textVertPosition: number - The height at which to display the percentage text withing the wave circle.
     *         0 = bottom, 1 = top.
     *       ~ textSize: number - The relative height of the text to display in the wave circle. 1 = 50%
     *       ~ valueCountUp: boolean - If true, the displayed value counts up from 0 to it's final value upon loading.
     *         If false, the final value is displayed.
     *       ~ displayPercent: boolean - If true, a % symbol is displayed after the value.
     *       ~ textColor: string - The color of the value text when the wave does not overlap it.
     *       ~ waveTextColor: string - The color of the value text when the wave overlaps it.
     *      }
     */
    var LiquidGauge = function LiquidGauge(element, metrics, contextId, configuration) {

        // CHECK FRAMEWORK
        if(!framework.isReady()) {
            console.error("LiquidGauge object could not be created because framework is not loaded.");
            return;
        }

        // CHECK D3
        if(typeof d3 === 'undefined') {
            console.error("LiquidGauge could not be loaded because d3 did not exist.");
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

        // Create SVG element inside the container element
        this.element.append('<svg class="blurable"></svg>');
        this.svg = this.element.children("svg");
        this.svg.get(0).style.minHeight = this.configuration.height + "px";

        this.observeCallback = this.commonObserveCallback.bind(this);

        framework.data.observe(metrics, this.observeCallback , contextId);

    };

    LiquidGauge.prototype = new framework.widgets.CommonWidget(true);

    LiquidGauge.prototype.updateData = function(data) {
        var resourceId = Object.keys(data)[0];
        var resourceUID = Object.keys(data[resourceId])[0];
        this.data = data[resourceId][resourceUID]['data'];

        if(this.chart == null) {
            loadLiquidFillGauge(this.svg.get(0), this.data.values[0], this.configuration);
        } else {
            this.chart.update(this.data.values[0]);
        }



    };

    LiquidGauge.prototype.delete = function() {

        //Stop observing for data changes
        framework.data.stopObserve(this.observeCallback);

        //Clear DOM
        this.element.empty();

    };

    window.framework.widgets.LiquidGauge = LiquidGauge;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [], function () { return LiquidGauge; } );
    }



    /*!
     * @license Open source under BSD 2-clause (http://choosealicense.com/licenses/bsd-2-clause/)
     * Copyright (c) 2015, Curtis Bratton
     * All rights reserved.
     *
     * Liquid Fill Gauge v1.1
     */
    function loadLiquidFillGauge(svg, value, config) {

        var gauge = d3.select(svg);
        var radius = Math.min(parseInt(gauge.style("width")), parseInt(gauge.style("height")))/2;
        var locationX = parseInt(gauge.style("width"))/2 - radius;
        var locationY = parseInt(gauge.style("height"))/2 - radius;
        var fillPercent = Math.max(config.minValue, Math.min(config.maxValue, value))/config.maxValue;

        var waveHeightScale;
        if(config.waveHeightScaling){
            waveHeightScale = d3.scale.linear()
                .range([0,config.waveHeight,0])
                .domain([0,50,100]);
        } else {
            waveHeightScale = d3.scale.linear()
                .range([config.waveHeight,config.waveHeight])
                .domain([0,100]);
        }

        var textPixels = (config.textSize*radius/2);
        var textFinalValue = parseFloat(value).toFixed(2);
        var textStartValue = config.valueCountUp?config.minValue:textFinalValue;
        var percentText = config.displayPercent?"%":"";
        var circleThickness = config.circleThickness * radius;
        var circleFillGap = config.circleFillGap * radius;
        var fillCircleMargin = circleThickness + circleFillGap;
        var fillCircleRadius = radius - fillCircleMargin;
        var waveHeight = fillCircleRadius*waveHeightScale(fillPercent*100);

        var waveLength = fillCircleRadius*2/config.waveCount;
        var waveClipCount = 1+config.waveCount;
        var waveClipWidth = waveLength*waveClipCount;

        // Rounding functions so that the correct number of decimal places is always displayed as the value counts up.
        var textRounder = function(value){ return Math.round(value); };
        if(parseFloat(textFinalValue) != parseFloat(textRounder(textFinalValue))){
            textRounder = function(value){ return parseFloat(value).toFixed(1); };
        }
        if(parseFloat(textFinalValue) != parseFloat(textRounder(textFinalValue))){
            textRounder = function(value){ return parseFloat(value).toFixed(2); };
        }

        // Data for building the clip wave area.
        var data = [];
        for(var i = 0; i <= 40*waveClipCount; i++){
            data.push({x: i/(40*waveClipCount), y: (i/(40))});
        }

        // Scales for drawing the outer circle.
        var gaugeCircleX = d3.scale.linear().range([0,2*Math.PI]).domain([0,1]);
        var gaugeCircleY = d3.scale.linear().range([0,radius]).domain([0,radius]);

        // Scales for controlling the size of the clipping path.
        var waveScaleX = d3.scale.linear().range([0,waveClipWidth]).domain([0,1]);
        var waveScaleY = d3.scale.linear().range([0,waveHeight]).domain([0,1]);

        // Scales for controlling the position of the clipping path.
        var waveRiseScale = d3.scale.linear()
            // The clipping area size is the height of the fill circle + the wave height, so we position the clip wave
            // such that the it will overlap the fill circle at all when at 0%, and will totally cover the fill
            // circle at 100%.
            .range([(fillCircleMargin+fillCircleRadius*2+waveHeight),(fillCircleMargin-waveHeight)])
            .domain([0,1]);
        var waveAnimateScale = d3.scale.linear()
            .range([0, waveClipWidth-fillCircleRadius*2]) // Push the clip area one full wave then snap back.
            .domain([0,1]);

        // Scale for controlling the position of the text within the gauge.
        var textRiseScaleY = d3.scale.linear()
            .range([fillCircleMargin+fillCircleRadius*2,(fillCircleMargin+textPixels*0.7)])
            .domain([0,1]);

        // Center the gauge within the parent SVG.
        var gaugeGroup = gauge.append("g")
            .attr('transform','translate('+locationX+','+locationY+')');

        // Draw the outer circle.
        var gaugeCircleArc = d3.svg.arc()
            .startAngle(gaugeCircleX(0))
            .endAngle(gaugeCircleX(1))
            .outerRadius(gaugeCircleY(radius))
            .innerRadius(gaugeCircleY(radius-circleThickness));
        gaugeGroup.append("path")
            .attr("d", gaugeCircleArc)
            .style("fill", config.circleColor)
            .attr('transform','translate('+radius+','+radius+')');

        // Text where the wave does not overlap.
        var text1 = gaugeGroup.append("text")
            .text(textRounder(textStartValue) + percentText)
            .attr("class", "liquidFillGaugeText")
            .attr("text-anchor", "middle")
            .attr("font-size", textPixels + "px")
            .style("fill", config.textColor)
            .attr('transform','translate('+radius+','+textRiseScaleY(config.textVertPosition)+')');

        // The clipping wave area.
        var clipArea = d3.svg.area()
            .x(function(d) { return waveScaleX(d.x); } )
            .y0(function(d) { return waveScaleY(Math.sin(Math.PI*2*config.waveOffset*-1 + Math.PI*2*(1-config.waveCount) + d.y*2*Math.PI));} )
            .y1(function(d) { return (fillCircleRadius*2 + waveHeight); } );
        var clipWaveId = Math.round(Math.random()*100000000);
        var waveGroup = gaugeGroup.append("defs")
            .append("clipPath")
            .attr("id", "clipWave" + clipWaveId);
        var wave = waveGroup.append("path")
            .datum(data)
            .attr("d", clipArea)
            .attr("T", 0);

        // The inner circle with the clipping wave attached.
        var fillCircleGroup = gaugeGroup.append("g")
            .attr("clip-path", "url(#clipWave" + clipWaveId + ")");
        fillCircleGroup.append("circle")
            .attr("cx", radius)
            .attr("cy", radius)
            .attr("r", fillCircleRadius)
            .style("fill", config.waveColor);

        // Text where the wave does overlap.
        var text2 = fillCircleGroup.append("text")
            .text(textRounder(textStartValue) + percentText)
            .attr("class", "liquidFillGaugeText")
            .attr("text-anchor", "middle")
            .attr("font-size", textPixels + "px")
            .style("fill", config.waveTextColor)
            .attr('transform','translate('+radius+','+textRiseScaleY(config.textVertPosition)+')');

        // Make the value count up.
        if(config.valueCountUp){
            var textTween = function(){
                var i = d3.interpolate(this.textContent, textFinalValue);
                return function(t) { this.textContent = textRounder(i(t)) + percentText; }
            };
            text1.transition()
                .duration(config.waveRiseTime)
                .tween("text", textTween);
            text2.transition()
                .duration(config.waveRiseTime)
                .tween("text", textTween);
        }

        // Make the wave rise. wave and waveGroup are separate so that horizontal and vertical movement can be controlled independently.
        var waveGroupXPosition = fillCircleMargin+fillCircleRadius*2-waveClipWidth;
        if(config.waveRise){
            waveGroup.attr('transform','translate('+waveGroupXPosition+','+waveRiseScale(0)+')')
                .transition()
                .duration(config.waveRiseTime)
                .attr('transform','translate('+waveGroupXPosition+','+waveRiseScale(fillPercent)+')')
                .each("start", function(){ wave.attr('transform','translate(1,0)'); }); // This transform is necessary to get the clip wave positioned correctly when waveRise=true and waveAnimate=false. The wave will not position correctly without this, but it's not clear why this is actually necessary.
        } else {
            waveGroup.attr('transform','translate('+waveGroupXPosition+','+waveRiseScale(fillPercent)+')');
        }

        if(config.waveAnimate) animateWave();

        function animateWave() {
            wave.attr('transform','translate('+waveAnimateScale(wave.attr('T'))+',0)');
            wave.transition()
                .duration(config.waveAnimateTime * (1-wave.attr('T')))
                .ease('linear')
                .attr('transform','translate('+waveAnimateScale(1)+',0)')
                .attr('T', 1)
                .each('end', function(){
                    wave.attr('T', 0);
                    animateWave(config.waveAnimateTime);
                });
        }

        function GaugeUpdater(){
            this.update = function(value){
                var newFinalValue = parseFloat(value).toFixed(2);
                var textRounderUpdater = function(value){ return Math.round(value); };
                if(parseFloat(newFinalValue) != parseFloat(textRounderUpdater(newFinalValue))){
                    textRounderUpdater = function(value){ return parseFloat(value).toFixed(1); };
                }
                if(parseFloat(newFinalValue) != parseFloat(textRounderUpdater(newFinalValue))){
                    textRounderUpdater = function(value){ return parseFloat(value).toFixed(2); };
                }

                var textTween = function(){
                    var i = d3.interpolate(this.textContent, parseFloat(value).toFixed(2));
                    return function(t) { this.textContent = textRounderUpdater(i(t)) + percentText; }
                };

                text1.transition()
                    .duration(config.waveRiseTime)
                    .tween("text", textTween);
                text2.transition()
                    .duration(config.waveRiseTime)
                    .tween("text", textTween);

                var fillPercent = Math.max(config.minValue, Math.min(config.maxValue, value))/config.maxValue;
                var waveHeight = fillCircleRadius*waveHeightScale(fillPercent*100);
                var waveRiseScale = d3.scale.linear()
                    // The clipping area size is the height of the fill circle + the wave height, so we position the clip wave
                    // such that the it will overlap the fill circle at all when at 0%, and will totally cover the fill
                    // circle at 100%.
                    .range([(fillCircleMargin+fillCircleRadius*2+waveHeight),(fillCircleMargin-waveHeight)])
                    .domain([0,1]);
                var newHeight = waveRiseScale(fillPercent);
                var waveScaleX = d3.scale.linear().range([0,waveClipWidth]).domain([0,1]);
                var waveScaleY = d3.scale.linear().range([0,waveHeight]).domain([0,1]);
                var newClipArea;
                if(config.waveHeightScaling){
                    newClipArea = d3.svg.area()
                        .x(function(d) { return waveScaleX(d.x); } )
                        .y0(function(d) { return waveScaleY(Math.sin(Math.PI*2*config.waveOffset*-1 + Math.PI*2*(1-config.waveCount) + d.y*2*Math.PI));} )
                        .y1(function(d) { return (fillCircleRadius*2 + waveHeight); } );
                } else {
                    newClipArea = clipArea;
                }

                var newWavePosition = config.waveAnimate?waveAnimateScale(1):0;
                wave.transition()
                    .duration(0)
                    .transition()
                    .duration(config.waveAnimate?(config.waveAnimateTime * (1-wave.attr('T'))):(config.waveRiseTime))
                    .ease('linear')
                    .attr('d', newClipArea)
                    .attr('transform','translate('+newWavePosition+',0)')
                    .attr('T','1')
                    .each("end", function(){
                        if(config.waveAnimate){
                            wave.attr('transform','translate('+waveAnimateScale(0)+',0)');
                            animateWave(config.waveAnimateTime);
                        }
                    });
                waveGroup.transition()
                    .duration(config.waveRiseTime)
                    .attr('transform','translate('+waveGroupXPosition+','+newHeight+')')
            }
        }

        return new GaugeUpdater();
    }

})();