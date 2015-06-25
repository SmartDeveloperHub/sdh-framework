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

    /**
     *
     * @param configuration
     * @returns {*}
     */
    var normalizeConfig = function normalizeConfig(configuration) {
        if (configuration == null) {
            configuration = {};
        }

        var defaultConfig = {
            columns: {
                type: 'object',
                default: []
            },
            height: {
                type: 'number',
                default: 240
            },
            filterControl: {
                type: 'boolean',
                default: false
            },
            paginationControl: {
                type: 'boolean',
                default: false
            },
            lengthControl: {
                type: 'boolean',
                default: false
            },
            tableInfo: {
                type: 'boolean',
                default: false
            },
            selectable: {
                type: 'boolean',
                default: true
            },
            maxRowsSelected: {
                type: 'number',
                default: 1
            },
            initialSelectedRows: {
                type: 'number',
                default: 0
            },
            updateContexts: {
                type: 'object',
                default: null
            }

        };

        for(var confName in defaultConfig) {
            var conf = defaultConfig[confName];
            if (typeof configuration[confName] != conf['type']) {
                configuration[confName] = conf['default'];
            }
        }

        return configuration;
    };

    /* Table constructor
     *   element: the DOM element that will contain the rangeNv
     *   data: the resources array. It should contain only a resource, or at least the same resources with different
     *      parameters.
     *   contextId: optional.
     *   configuration: additional table configuration:
     *      {
     *       ~ height: number - Height of the widget.
     *       ~ filterControl: boolean - Whether to display the search filter control or not.
     *       ~ paginationControl: boolean - Whether to display the pagination control or not.
     *       ~ lengthControl: boolean - Whether to display a selector with the number of rows to show or not.
     *       ~ tableInfo: boolean - Whether to show extra info about the table or not.
     *       ~ selectable: boolean - If true, the rows of this table can be selected. When selected, the contexts are
     *          are updated with the data updateContexts indicates.
     *       ~ maxRowsSelected: number - Maximum number of rows that can be selected at the same time.
     *       ~ initialSelectedRows: number - Number of rows that must be selected at the beginning. Default: 0.
     *       ~ updateContexts: array - Array of objects that configure how to update the contexts. It must contain an id with
     *          the id of the context and a filter array with the data to send through the context update.
     *          Each filter must contain a 'property' property with the name of the property of the data retrieved from
     *          the framework and can optionally add an 'as' property to indicate the name that it must have in the
     *          object that will be sent through the updateContext.
     *          Format:
     *          {
     *               id: <String>,
     *               filter: [
     *                   {
     *                       property: <String>,
     *                       as: <String> //optional
     *                   }
     *               ]
     *          }
     *          Example (listing all the repositories):
     *          {
     *               id: "repoContext",
     *               filter: [
     *                   {
     *                       property: "repositoryid",
     *                       as: "rid"
     *                   }
     *               ]
     *          }
     *       ~ columns: array - Array of objects with the configuration of all the columns to display in the table.
     *          Column object contains a 'label' and a 'property' or a link. Additionally it can contain a 'width' that
     *          may take any CSS value (3em, 20px, 10%, etc). Please note that pixel perfect column width is virtually
     *          impossible to achieve in tables with dynamic content.
     *          In case of a property, it is the name of the property of the data retrieved from the framework that
     *          must be displayed in that column.
     *          In case of a link, it displays a link to change to other dashboard. A link is an object with multiple
     *          properties: a 'href' with the name of the dashboard to go to, an 'icon' (class of the icon to display)
     *          or a 'label' (text) to display, and an 'env' that configures the environment info to send to the
     *          new dashboard. The 'env' property is an array of objects that contains a 'property' and an optional 'as'.
     *          Format:
     *          {
     *               label: <String>,
     *               property: <String>
     *           },
     *           {
     *              label: "Show",
     *               link: {
     *                   icon: <String>, //or label: <String>
     *                   href: <String>,
     *                   env: [
     *                       {
     *                           property: <String>,
     *                           as: <String>
     *                       }
     *                   ]
     *               }
     *          }, ...
     *          Example (listing all the repositories and changing to the dashboard of the selected repository):
     *          {
     *               label: "Name",
     *               property: "name"
     *           },
     *           {
     *              label: "Go to",
     *               link: {
     *                   icon: "fa fa-share-square-o",
     *                   href: "repository-dashboard",
     *                   env: [
     *                       {
     *                           property: "repositoryid",
     *                           as: "rid"
     *                       }
     *                   ]
     *               }
     *          }
     *      }
     */
    var Table = function Table(element, metrics, contextId, configuration) {

        if(!framework.isReady()) {
            console.error("Table object could not be created because framework is not loaded.");
            return;
        }

        this.element = $(element); //Store as jquery object
        this.data = null;

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

    Table.prototype = new framework.widgets.CommonWidget(true);

    /**
     *
     * @param framework_data
     */
    Table.prototype.updateData = function(framework_data) {

        if(this.tableDom == null) {

            //Create the html for the table
            this.element.append('<table class="blurable table table-striped table-bordered"><thead><tr></tr></thead><tbody></tbody></table>');
            this.tableDom = this.element.children("table");
            this.tableDom.get(0).style.minHeight = this.configuration.height;

            //Add click listener for links
            this.tableDom.on( 'click', '.dashboardLink', this, dashboardLinkClickHandler);

            //Handle clicks in rows to select them or not
            if(this.configuration.selectable) {
                this.tableDom.on('click', 'tbody tr', this, rowClickHandler);
            }
        }

        var normalizedData = getNormalizedData.call(this,framework_data);

        var head = this.tableDom.find("thead tr");
        head.empty();

        for(var i in this.configuration.columns) {
            head.append("<th>" + this.configuration.columns[i]['label'] + "</th>")
        }

        //Create dom configuration string
        var dom = "t";
        if(this.configuration.filterControl) dom += 'f';
        if(this.configuration.lengthControl) dom += 'l';
        if(this.configuration.tableInfo) dom += 'i';
        if(this.configuration.paginationControl) dom += 'p';

        // Get columns
        var columns = [];
        for(var i in this.configuration.columns) {

            var columnConfig = this.configuration.columns[i];
            var column = null;

            if(columnConfig['property'] != null) { //Is a property
                column = { data: columnConfig['property'] };

            } else if(columnConfig['link'] != null && columnConfig['link']['href'] != null) { //Is a link
                column = {
                    data: function(){ return columnConfig['link']; },
                    orderable: false,
                    searchable: false,
                    render: columnIconRenderer
                };

            }

            //If it has the required properties
            if(column != null) {

                if(columnConfig['width'] != null) {
                    column['width'] = columnConfig['width'];
                }

                columns.push(column);
            }


        }

        //Destroy the table it already exists
        if(this.table != null) {
            this.table.destroy();
        }

        //DataTable object
        this.table = this.tableDom.DataTable({
            data: normalizedData,
            dom: dom,
            columns: columns
        });

        // If some rows must be selected from the beginning
        if(this.configuration.selectable && this.configuration.initialSelectedRows > 0) {

            //Select the first n rows
            this.table.$('tr').slice(0, this.configuration.initialSelectedRows).addClass('selected');

            //Update the contexts with the new selected rows
            updateContexts.call(this);
        }

    };

    /**
     * Deletes the widget.
     */
    Table.prototype.delete = function() {

        //Stop observing for data changes
        framework.data.stopObserve(this.observeCallback);

        //Remove event listeners
        this.tableDom.off();

        //Destroy DataTable
        this.table.destroy();

        //Clear DOM
        this.tableDom.empty();
        this.element.empty();

        this.tableDom = null;
        this.table = null;

    };

    // PRIVATE METHODS - - - - - - - - - - - - - - - - - - - - - -

    /**
     * Renderer for columns that contain links.
     * @param linkInfo Info about the link. Must contain an icon property (with the class of the icon to display)
     *           or a label property (with the text to display).
     *           See https://datatables.net/reference/option/columns.render#function
     * @param type See https://datatables.net/reference/option/columns.render#function
     * @param rowData See https://datatables.net/reference/option/columns.render#function
     * @returns {*}
     */
    var columnIconRenderer = function columnIconRenderer(linkInfo, type, rowData) {

        if ( type === 'display' ) {

            if (linkInfo['icon'] != null) { //It is an icon
                return '<div class="dashboardLink ' + linkInfo['icon'] + '"></div>';
            } else { //Just a label
                return '<div class="dashboardLink">' + linkInfo['label'] + '</div>';
            }

        }

        return linkInfo;

    };

    /**
     * Function that handles the click in a dashboard link.
     * @param e
     */
    var dashboardLinkClickHandler = function dashboardLinkClickHandler(e) {

        e.stopImmediatePropagation(); // stop the row selection when clicking on an icon

        var widget = e.data;
        var cell = $(this).parent();

        var linkInfo = widget.table.cell(cell).data();
        var rowData = widget.table.cell(cell).row().data();

        //Generate the env
        var env = null;
        if (linkInfo['env'] != null) {
            env = generateEnv(linkInfo['env'], rowData);
        }

        //Change the dashboard
        framework.dashboard.changeTo(linkInfo['href'], env);

    };

    /**
     * Function that handles clicks in rows. When selecting a row it may be necessary to update contexts.
     * @param e
     */
    var rowClickHandler = function rowClickHandler(e) {
        e.stopImmediatePropagation();
        var widget = e.data;

        if ( $(this).hasClass('selected') ) { //It is already selected
            $(this).removeClass('selected');

        } else { //Not selected

            //Select it if the maximum of selected rows has not been achieved
            if(widget.configuration.maxRowsSelected > widget.table.$('tr.selected').length) {
                $(this).addClass('selected');
            }

        }

        // Update contexts with the selected rows
        updateContexts.call(widget);

    };

    /**
     * Update the contexts with the selected rows
     */
    var updateContexts = function updateContexts(){

        // Update contexts
        var contexts = this.configuration.updateContexts;
        if(contexts != null) {

            for(var i in contexts) {
                var context = contexts[i];

                if(context['id'] != null) {

                    // Data to send through the context
                    var data = {};

                    // Filter the data to send through the context update
                    if(context['filter'] != null) {
                        for(var f = 0; f < context['filter'].length; ++f) {

                            var filter = context['filter'][f];
                            var property = filter['property'];
                            var as = filter['as'] || property;

                            if(data[as] == null) {
                                data[as] = [];
                            }

                            //Selected items
                            var selected = this.table.$('tr.selected');

                            //Calculate the data to send for all the selected rows
                            for(var s = 0, len = selected.length; s < len; ++s) {

                                var selectedData = this.table.row(selected[s]).data();
                                var propertyValue = selectedData[property];

                                if(property != null && typeof propertyValue !== 'undefined') {
                                    data[as].push(propertyValue);
                                }

                            }
                        }

                    }

                    //Send the update context
                    framework.data.updateContext(context['id'], data);
                }
            }
        }

    };

    /**
     * Generates an environment object containing all the information of the environment
     * @param envProperty The env configuration property
     * @param rowData Al, the data of the row.
     * @returns {{}}
     */
    var generateEnv = function generateEnv(envProperty, rowData) {

        var env = {};

        for(var e = 0; e < envProperty.length; ++e) {

            var envEntry = envProperty[e];
            var property, as, envValue;

            if(envEntry['property'] != null) {

                property = envEntry['property'];
                as = envEntry['as'] || property;
                envValue = rowData[property];

            } else if(envEntry['currentEnv']) {

                property = envEntry['currentEnv'];
                as = envEntry['as'] || property;
                envValue = framework.dashboard.getEnv()[property];

            }

            if(typeof envValue !== 'undefined') {
                env[as] = envValue;
            }

        }

        return env;
    };

    /**
     * Gets a normalized array of data according to the chart expected input from the data returned by the framework.
     * @param framework_data
     * @returns {Array} Contains objects with 'label' and 'value'.
     */
    var getNormalizedData = function getNormalizedData(framework_data) {

        return this.extractAll(framework_data);

    };

    window.framework.widgets.Table = Table;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( ['datatables',
            'css!sdh-framework/lib/jquery/datatables/css/jquery.dataTables.min'], function () { return Table; } );
    }

})();