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

    /*
     -------------------------------
     ------ FRAMEWORK GLOBALS ------
     -------------------------------
     */

    //Variable where public methods and variables will be stored
    var _self = { data: {}, widgets: {}, dashboard: {} };

    //Path to the SDH-API server without the trailing slash
    var _serverUrl;

    // Array with the information about the different resources of the API
    var _resourcesInfo;

    // List of all the parameters that can be used with the API.
    // It is only for performance purposes while checking input.
    var _existentParametersList = [];

    // Storage of the data data
    var _resourcesStorage = {}; //TODO: multi-level cache

    var _resourcesContexts = {};

    // Contains a list that links user callbacks (given as parameter at the observe methods) with the internal
    // callbacks. It is need to remove handlers when not used and free memory.
    var _event_handlers = [];

    // This is a variable to make the events invisible outside the framework
    var _eventBox = {};

    // Dashboard controller
    var _dashboardController = null;

    var _dashboardEnv = {};

    // This contains the listeners for each of the events of the dashboard
    var _dashboardEventListeners = {
        'change' : []
    };

    var _isReady = false;

    var FRAMEWORK_NAME = "SDHWebFramework";



    /*
     -------------------------------
     -- FRAMEWORK PRIVATE METHODS --
     -------------------------------
     */

    /**
     * Prints a framework error
     * @param message Message to display.
     */
    var error = function error(message) {
        console.error("[" + FRAMEWORK_NAME +  "] " + message);
    };

    /**
     * Prints a framework warning
     * @param message Message to display.
     */
    var warn = function warn(message) {
        console.warn("[" + FRAMEWORK_NAME +  "] " + message);
    };


    var requestJSON = function requestJSON(path, queryParams, callback, maxRetries) {

        if(typeof maxRetries === 'undefined'){
            maxRetries = 2; //So up to 3 times will be requested
        }

        $.getJSON( _serverUrl + path, queryParams, callback).fail( function(d, textStatus, e) {
            error("Framework getJSON request failed\nStatus: " + textStatus + " \nError: "+ (e ? e : '-') + "\nRequested url: '"+
            path+"'\nParameters: " + JSON.stringify(queryParams));

            //Retry the request
            if (maxRetries > 0 && textStatus === "timeout") {
                requestJSON(path, queryParams, callback, --maxRetries);
            }

        });

    };

    /**
     * Fills _resourcesInfo hashmap with the reources info and the following structure:
     * {
     *       "{resource-id}": {
     *           path:"yourpath/../sdfsdf",
     *           params: ['param1', 'param2'],
     *           queryParams: ['queryParam1']
     *       },
     *       ...
     *   }
     * @param onReady
     */
    var loadResourcesInfo = function loadResourcesInfo(onReady) {

        requestJSON("/api/", null, function(data) {

            //var paths = data['swaggerjson']['paths'];
            var paths = [{
                path :"/metrics",
                variable: "mid"
            },{
                path :"/tbdata",
                variable: "tid"
            }];

            var apiPaths = data['swaggerjson']['paths'];

            //Count number of elements in paths
            var pathsLength = 0;
            for(var i in paths) pathsLength++;

            //Function to check if it has finished and call the callback
            var pathsProcessed = 0;
            var pathProcessed = function() {
                if(++pathsProcessed === pathsLength && 'function' === typeof onReady) {
                    onReady();
                }
            };

            //Initialize the _resourcesInfo object
            _resourcesInfo = {};

            //var isMetricList = /\/data\/$/;
            //var isMetricListWithoutParams = /^((?!\{).)*\/data\/$/;
            //var isSpecificMetric = /\/\{mid\}$/;



            //TODO: I dont like this, but till now there is not any other way to get static data...
            var statInfo = [
                // API static Information description
                { "id" : "userinfo", "path" : "/users/{uid}", params: {'uid': {name: 'uid',in: 'path',required: true}}, "description" : "User Information" },
                { "id" : "repoinfo", "path" : "/repositories/{rid}", params: {'rid': {name: 'rid',in: 'path',required: true}}, "description" : "Repository Information" },
                { "id" : "orginfo", "path" : "/", "description" : "Organization Information" },
                { "id" : "userlist", "path" : "/users/", "description" : "Users List" },
                { "id" : "repolist", "path" : "/repositories/", "description" : "Repository List" },
                { "id" : "metriclist", "path" : "/metrics/", "description" : "Metrics list" },
                { "id" : "tbdlist", "path" : "/tbd/", "description" : "Time-based data list" }
            ];

            for(var i = statInfo.length - 1; i >= 0; --i ) {
                var info = statInfo[i];
                _resourcesInfo[info['id']] = {
                    path: info['path'],
                    requiredParams: (info.params != null ? info.params :  {}), //list of url param names
                    optionalParams: {} //list of query params
                };
            }
            //TODO: END TODO ----------------------------



            //Iterate over the path of the api
            for(var x = paths.length - 1; x >= 0; --x ) {

                var path = paths[x]['path'];

                // Make an api request to retrieve all the data
                requestJSON(path, null, function(p, data) {

                    //Iterate over the resources
                    for(var j = 0, len = data.length; j < len; ++j) {

                        var resourceInfo = data[j];
                        var resourceId = resourceInfo['id'];
                        var resourcePath = resourceInfo['path'];

                        // Fill the _resourcesInfo array
                        _resourcesInfo[resourceId] = {
                            path: resourcePath,
                            requiredParams: {}, //list of url param names
                            optionalParams: {} //list of query params
                        };

                        //Get the general resource path info (like /data/{mid})
                        var generalResourcePath = resourcePath.substring(0, resourcePath.lastIndexOf('/')) + '/{'+paths[p]['variable']+'}';
                        var generalResourcePathInfo = apiPaths[generalResourcePath];

                        if(generalResourcePathInfo == null) {
                            error("General resource path ("+generalResourcePathInfo+") does not exist in API path list.");
                            continue;
                        }

                        //Add the url params and query params to the list
                        if(generalResourcePathInfo['get']['parameters'] != null) {
                            var parameters = generalResourcePathInfo['get']['parameters'];

                            //Add all parameters and avoid 'mid'
                            for(var i = 0, len_i = parameters.length; i < len_i; i++) {

                                var paramName = parameters[i]['name'];

                                //Add the parameter in params or queryParams
                                if(paramName === paths[p]['variable']) {
                                    //Ignore it
                                } else if (parameters[i]['required'] == true || resourceInfo['params'].indexOf(paramName) !== -1) {
                                    _resourcesInfo[resourceId]['requiredParams'][paramName] = {
                                        name: paramName,
                                        in: parameters[i]['in'],
                                        required: true
                                    };
                                } else if(resourceInfo['optional'].indexOf(paramName) !== -1) {
                                    _resourcesInfo[resourceId]['optionalParams'][paramName] = {
                                        name: paramName,
                                        in: parameters[i]['in'],
                                        required: false
                                    };
                                }

                                //Add it to the list of possible parameters (cache)
                                if(_existentParametersList.indexOf(parameters[i]['name']) === -1) {
                                    _existentParametersList.push(parameters[i]['name']);
                                }
                            }
                        }
                    }

                    pathProcessed(); //Finished processing this path
                }.bind(null, x));


            }

        });
    };

    /**
     * Checks if the resource object has all the information that is needed to request the resource data
     * @param resource A resource object. At least must have the id. Can have other parameters, like range, userId...
     * @returns {boolean}
     */
    var resourceCanBeRequested = function resourceCanBeRequested(resource) {

        if(resource['id'] == null) {
            return false;
        }

        var resourceInfo = _resourcesInfo[resource['id']];

        if(resourceInfo == null) {
            return false;
        }

        for(var paramId in resourceInfo['requiredParams']) {
            var paramValue = resource[paramId];

            if(paramValue == null) {
                return false;
            }
        }

        return true;

    };

    /**
     * Checks if all the given resources fulfill all the requirements to be requested
     * @param resources Array of normalized resources
     * @returns {boolean}
     */
    var allResourcesCanBeRequested = function allResourcesCanBeRequested(resources) {
        for(var i in resources) {
            if(!resourceCanBeRequested(resources[i])) {
                return false;
            }
        }

        return true;
    };

    /**
     * Request a given resource
     * @param resourceId
     */
    var makeResourceRequest = function makeResourceRequest(resourceId, params, callback) {

        var resourceInfo = _resourcesInfo[resourceId];

        var queryParams = {};

        if(resourceInfo != null) {

            /* Generate path */
            var path = resourceInfo.path;

            // Replace params in url skeleton
            for(var paramId in params) {

                var paramInfo = resourceInfo['requiredParams'][paramId] || resourceInfo['optionalParams'][paramId];
                var paramValue = params[paramId];

                if(paramValue == null) { //It has no value (ignore it or throw an error)
                    if(paramInfo['required'] === true) {
                        error("Resource '"+ resourceId + "' needs parameter '"+ paramId +"'.");
                        return;
                    }

                } else if(paramInfo['in'] === 'query') {
                    queryParams[paramId] = paramValue;

                } else if(paramInfo['in'] === 'path') {
                    path = path.replace('{'+paramId+'}',  paramValue);
                }

            }



            /* Make the request */
            requestJSON(path, queryParams, callback);

        } else {
            error("Resource '"+ resourceId + "' does not exist.");
        }

    };

    /**
     * Requests multiple resources
     * @param resources Normalized resource
     * @param callback
     * @param unique Is this is a request that do not depend on any context, so it will be executed only once
     */
    var multipleResourcesRequest = function multipleResourcesRequest(resources, callback, unique) {

        var completedRequests = 0;
        var allData = {};
        var requests = [];

        var onResourceReady = function(resourceId, params, data) {

            if(allData[resourceId] == null) {
                allData[resourceId] = [];
            }

            //Add the framework info to the data received from the api
            var resUID = resourceHash(resourceId, params);
            var info = {
                UID: resUID,
                request: {
                    params: params
                }
            };

            allData[resourceId].push({
                data: data,
                info: info
            });

            if(++completedRequests === requests.length) {
                sendDataEventToCallback(allData, callback, unique);
            }
        };

        //Send a loading data event to the listener
        sendLoadingEventToCallback(callback);

        for(var i in resources) {

            var resourceId = resources[i].id;
            var params = {};
            var multiparams = [];

            //Fill the params and multiparams
            for(var name in resources[i]) {

                if(_resourcesInfo[resourceId]['optionalParams'][name] != null || _resourcesInfo[resourceId]['requiredParams'][name] != null) { //Is a param

                    //Check if is multi parameter and add it to the list of multi parameters
                    if(resources[i][name] instanceof Array) {
                        multiparams.push(name);
                    }

                    params[name] =  resources[i][name];

                }
            }

            var requestsCombinations = generateResourceRequestParamsCombinations(resourceId, params, multiparams);
            requests = requests.concat(requestsCombinations);

        }

        for(var i in requests) {
            var resourceId = requests[i]['resourceId'];
            var params = requests[i]['params'];

             makeResourceRequest(resourceId, params, onResourceReady.bind(undefined, resourceId, params));
        }

    };

    /**
     * Generates an array of requests combining all the values of the multi parameters (param and queryParam).
     * @param resourceId
     * @param params Hash map of param name and values.
     * @param multiparam List of parameter names that have multiple values.
     * @returns {Array} Array of requests to execute for one resource
     */
    var generateResourceRequestParamsCombinations = function (resourceId, params, multiparam) {

        var paramsCombinations = generateParamsCombinations(params, multiparam);
        var allCombinations = [];

        //Create the combinations of params and queryParams
        for(var i = 0, len_i = paramsCombinations.length; i < len_i; ++i) {
            allCombinations.push({
                resourceId: resourceId,
                params: paramsCombinations[i]
            });
        }

        return allCombinations;

    };

    /**
     * Generates all the combinations of multi parameters.
     * @param params Hash map of param name and values.
     * @param multiParams List of parameter names that have multiple values.
     * @returns {Array} Array of parameter combinations.
     */
    var generateParamsCombinations = function generateParamsCombinations(params, multiParams) {

        //Clone params before modifying them
        params = clone(params);

        if(multiParams.length > 0) {

            var result = [];

            //Clone function params before modifying them
            multiParams = clone(multiParams);

            //Remove the parameter from the list of multi parameters
            var param = multiParams.pop();

            //Save the values of the parameter because it will be modified
            var values = params[param];

            //For each value generate the possible combinations
            for(var i in values) {

                var value = values[i];

                //Overwrite array with only one value
                params[param] = value;

                //Generate the combinations for that value
                var combinations = generateParamsCombinations(params, multiParams);

                result = result.concat(combinations);

            }

            return result;

        } else { //End of recursion
            return [ params ];
        }
    };


    /**
     * Converts the array of resources containing a mixture of strings (for simple resources) and objects (for complex resources)
     * into an array of objects with at least an id.
     * @param resources Array of resources containing a mixture of strings (for simple resources) and objects (for complex resources).
     * It can be modified, so consider cloning it if necessary.
     * @returns {Array}
     */
    var normalizeResources = function normalizeResources(resources) {

        var newMetricsParam = [];
        for(var i in resources) {

            if('string' === typeof resources[i]) {
                newMetricsParam.push({id: resources[i]});
            } else if('object' === typeof resources[i] && resources[i]['id']) { //Metrics objects must have an id
                newMetricsParam.push(resources[i]);
            } else {
                warn("One of the resources given was not string nor object so it has been ignored.");
            }
        }

        //Remove invalid resources and parameters
        newMetricsParam = cleanResources(newMetricsParam);

        return newMetricsParam;

    };

    /**
     * Cleans an array of resource objects removing the non existent ones and the invalid parameters of them.
     * @param resources Array of resource objects to clean.
     */
    var cleanResources = function cleanResources(resources) {

        var newResources = [];

        for(var i = 0; i < resources.length; ++i) {
            var resource = resources[i];
            var resourceId = resource['id'];
            var resourceInfo = _resourcesInfo[resourceId];

            if(resourceInfo == null) {
                warn("Resource '"+resourceId+"' does not exist.");
            } else { //Check its parameters
                var cleanParameters = {};
                for(var paramName in resource) {
                    if(paramName != 'id' && paramName != 'static' && resourceInfo['requiredParams'][paramName] == null && resourceInfo['optionalParams'][paramName] == null) {
                        warn("Parameter '"+paramName+"' is not a valid parameter for resource '"+resourceId+"'.");
                    } else {
                        cleanParameters[paramName] = resource[paramName];
                    }
                }

                if(Object.keys(cleanParameters).length > 0) {
                    newResources.push(cleanParameters);
                }
            }
        }

        return newResources;
    };

    /** Clone the object
     * @obj1 Object to clone.
     * @return {object} */
    var clone = function clone(obj1) {
        var result;

        if (obj1 == null) {
            return obj1;
        } else if (Array.isArray(obj1)) {
            result = [];
        } else if (typeof obj1 === 'object') {
            result = {};
        } else {
            return obj1;
        }

        for (var key in obj1) {
            result[key] = clone(obj1[key]);
        }

        return result;
    };


    /**
     * Deep merge in obj1 object. (Priority obj2)
     * @param obj1
     * @param obj2
     * @param mergeArrays If true, combines arrays. Otherwise, if two arrays must be merged,
     * the obj2's array overwrites the other. Default: true.
     * @returns {*}
     */
    var mergeObjects = function mergeObjects(obj1, obj2, mergeArrays) {

        mergeArrays = mergeArrays || true;

        if (Array.isArray(obj2) && Array.isArray(obj1) && mergeArrays) {
            // Merge Arrays
            var i;
            for (i = 0; i < obj2.length; i++) {
                if (typeof obj2[i] === 'object' && typeof obj1[i] === 'object') {
                    obj1[i] = mergeObjects(obj1[i], obj2[i], mergeArrays);
                } else {
                    obj1[i] = obj2[i];
                }
            }
        } else if (Array.isArray(obj2)) {
            // Priority obj2
            obj1 = obj2;
        } else {
            // object case j
            for (var p in obj2) {
                if(obj1.hasOwnProperty(p)){
                    if (typeof obj2[p] === 'object' && typeof obj1[p] === 'object') {
                        obj1[p] = mergeObjects(obj1[p], obj2[p], mergeArrays);
                    } else {
                        obj1[p] = obj2[p];
                    }
                } else {
                    obj1[p] = obj2[p];
                }
            }
        }
        return obj1;
    };

    /**
     * Generates a hashcode given an string
     * @param str
     * @returns {number} 32 bit integer
     */
    var hashCode = function hashCode(str) {
        var hash = 0, i, chr, len;
        if (str.length == 0) return hash;
        for (i = 0, len = str.length; i < len; i++) {
            chr   = str.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    };


    var resourceHash = function resourceHash(resourceId, requestParams){

        var str = resourceId;
        var hasheable = "";
        for(var i in _resourcesInfo[resourceId]['requiredParams']){
            var param = _resourcesInfo[resourceId]['requiredParams'][i]['name'];
            hasheable += param  + requestParams[param] + ";"
        }

        return resourceId + "#" + hashCode(hasheable).toString(16);
    };

    /**
     * Combines an incomplete resource with a context in order to create a complete resource to make a request with.
     * @param resources
     * @param contexts Context ids
     */
    var combineResourcesWithContexts = function combineResourcesWithContexts(resources, contexts) {

        var newResources = [];
        var contextsData = [];

        //Fill the array with data for each context
        for(var i in contexts) {
            contextsData.push(_resourcesContexts[contexts[i]]['data']);
        }

        //Iterate through the resources and combine them with the contexts
        for(var i in resources) {

            //Clone the resource object to avoid modification
            var resource = clone(resources[i]);

            //Modify the resource with all the contexts
            for(var c in contextsData) {

                //Clean the context
                var mergeContext = getCleanContextByResource(contextsData[c], resource);

                resource = mergeObjects(resource, mergeContext, false);
            }

            //Add the resource to the returned array
            newResources.push(resource);
        }

        return newResources;
    };

    /**
     * Initializes the context container for the given contextId
     * @param contextId
     */
    var initializeContext = function initializeContext(contextId) {
        _resourcesContexts[contextId] = { updateCounter: 0, data: {} };
    };

    /**
     * Gets a new context with only the params and query params accepted by the resource (taking into account the static
     * params).
     * @param context Object
     * @param resource A resource object (only id and static are used).
     */
    var getCleanContextByResource = function getCleanContextByResource(context, resource) {
        var newContext = {};
        var resourceInfo = _resourcesInfo[resource['id']];

        var statics;
        if(resource['static'] != null){
            statics = resource['static'];
        } else {
            statics = [];
        }

        //Add all the params this resource accepts
        for(var name in resourceInfo['requiredParams']) {
            if(context[name] !== undefined && statics.indexOf(name) === -1){
                newContext[name] = context[name];
            }
        }

        //Add all the query params this resource accepts
        for(var name in resourceInfo['optionalParams']) {
            if(context[name] !== undefined && statics.indexOf(name) === -1){
                newContext[name] = context[name];
            }
        }

        return newContext;

    };

    /**
     * Checks if the given object is empty
     * @param o Object to check.
     * @returns {boolean} True if empty; false otherwise.
     */
    var isObjectEmpty = function isObjectEmpty(o) {
        for(var i in o)
            return false;
        return true;
    };

    /**
     * Send a data event to the given observer. This means that the data the framework was loading is now ready.
     * @param data New data.
     * @param callback
     * @param unique Is this is a request that do not depend on any context, so it will be executed only once
     */
    var sendDataEventToCallback = function sendDataEventToCallback(data, callback, unique) {

        if(typeof callback === "function") {

            var observed = false;
            if(!unique) { //Check if it still is being observed
                for (var i in _event_handlers) {
                    if (_event_handlers[i].userCallback === callback) {
                        observed = true;
                        break;
                    }
                }
            } else {
                observed = true;
            }

            if(observed) {
                callback({
                    event: "data",
                    data: data
                });
            }

        }
    };

    /**
     * Send a loading event to the given observer. That means that the framework is loading new data for that observer.
     * @param callback
     */
    var sendLoadingEventToCallback = function sendLoadingEventToCallback(callback) {
        callback({
            event: "loading"
        });
    };



    /*
       -------------------------------
       -- FRAMEWORK PUBLIC METHODS ---
       -------------------------------
     */

    /**
     *
     * @param resources Array with resources. Each resource can be an String or an Object. The object must have the following
     * format: {
     *              id: String,
     *              <param1Id>: String,
     *              <paramxId>: String,
     *          }
     *  For example: {
     *                   id: "usercommits",
     *                   uid: "pepito",
     *                   from :  new Date(),
     *                   max: 0,
     *                   static: ["from"] //Static makes this parameter unalterable by the context changes.
     *                                    //Static parameters must have a value; otherwise, an error will be returned.
     *               }
     * @param callback Callback that receives an object containing at least an "event" that can be "data" or "loading".
     *  - loading means that the framework is retrieving new data for the observer.
     *  - data means that the new data is ready and can be accessed through the "data" element of the object returned to
     *  the callback. The "data" element of the object is a hashmap using as key the resourceId of the requested resources
     *  and as value an array with data for each of the request done for that resourceId.
     * @param contextIds Array of context ids.
     */
    _self.data.observe = function observe(resources, callback, contextIds) {

        if('function' !== typeof callback){
            error("Method 'observeData' requires a valid callback function.");
            return;
        }

        if(!Array.isArray(resources) || resources.length === 0 ) {
            error("Method 'observeData' has received an invalid resources parameter.");
            return;
        }

        if(contextIds != null && !(contextIds instanceof Array) ) {
            error("Method 'observeData' expects contextIds parameter to be null or an array.");
            return;
        }

        //Normalize the array of resources
        resources = normalizeResources(resources);

        if(resources.length === 0) {
            warn("No resources to observe.");
            return;
        }

        //Check that static parameters have their value defined in the resource
        for(var i = 0; i < resources.length; ++i) {
            if(resources[i]['static'] != null && resources[i]['static'].length > 0) {
                for(var s = 0; s < resources[i]['static'].length; ++s) {
                    var staticParam = resources[i]['static'][s];
                    if(resources[i][staticParam] == null) {
                        error("Static parameter '"+staticParam+"' must have its value defined.");
                        return;
                    }
                }
            }

        }

        //Is an Array, verify that it only contains strings
        if(contextIds instanceof Array) {

            //We will use it internally, so we need to clone it to prevent the user changing it
            contextIds = clone(contextIds);

            //If one of the contexts is not an string, remove it from the array
            for(var i = 0; i < contextIds.length; ++i) {
                if(typeof contextIds[i] != 'string') {
                    contextIds.splice(i,  1);
                }
            }
        } else { //Invalid parameter type (or null)
            contextIds = []
        }

        //Initialize contexts it they are not initialized
        for(var i = 0; i < contextIds.length; ++i) {
            if (_resourcesContexts[contextIds[i]] == null) {
                initializeContext(contextIds[i]);
            }
        }

        //If contexts are defined, combine the resources with the context in order to create more complete resources that could
        // be requested.
        if(contextIds.length > 0) {

            //Combine the resources with the context in order to create more complete resources that could be requested.
            var resourcesWithContext = combineResourcesWithContexts(resources, contextIds);

            //Request all the resources if possible
            if(allResourcesCanBeRequested(resourcesWithContext)) {
                multipleResourcesRequest(resourcesWithContext, callback, false);
            }

            //Create the CONTEXT event handler
            var contextEventHandler = function(event, contextCounter, contextChanges, contextId) {

                //If it is not the last context event launched, ignore the data because there is another more recent
                // event being executed
                if(contextCounter != _resourcesContexts[contextId]['updateCounter']){
                    return;
                }

                //Check if the changes affect to the resources
                var affectedResources = [];
                for(var i in resources) {
                    var cleanContextChanges = getCleanContextByResource(contextChanges, resources[i]);
                    if(!isObjectEmpty(cleanContextChanges)){
                        affectedResources.push(resources[i]);
                    }
                }

                if(affectedResources.length === 0) {
                    return; //The context change did not affect to none the resources
                }

                //TODO: when implementing the cache, affectedResources should be used to only request the changed resources.
                //Currently, as there is no cache, all the data must be requested because it is not stored anywhere.

                //Update the resources with the context data
                var resourcesWithContext = combineResourcesWithContexts(resources, contextIds);

                if(allResourcesCanBeRequested(resourcesWithContext)) {
                    multipleResourcesRequest(resourcesWithContext, callback, false);
                }
            };

            //Link user callbacks with event handlers
            _event_handlers.push({
                userCallback: callback,
                contexts: contextIds,
                contextHandler: contextEventHandler
            });

            // Create the CONTEXT event listener for each of the contexts
            for(var c in contextIds) {
                $(_eventBox).on("CONTEXT" + contextIds[c], contextEventHandler);
            }

        } else { //No context is set

            //Request all the resources
            if(allResourcesCanBeRequested(resources)) {
                multipleResourcesRequest(resources, callback, true);
            } else {
                error("Some of the resources have not information enough for an 'observe' without context or does not exist.");
            }
        }

    };

    /**
     * Cancels observing for an specific callback
     * @param callback The callback that was given to the observe methods
     */
    _self.data.stopObserve = function stopObserve(callback) {
        for (var i in _event_handlers) {
            if(_event_handlers[i].userCallback === callback) {
                for (var c in _event_handlers[i]['contexts']) {
                    $(_eventBox).off("CONTEXT" + _event_handlers[i]['contexts'][c], _event_handlers[i]['contextHandler']);
                }
                _event_handlers.splice(i, 1);
            }
        }
    };

    /**
     * Cancels observing for everything.
     */
    _self.data.stopAllObserves = function stopAllObserves() {

        //Remove all the event handlers
        for (var i in _event_handlers) {
            for (var c in _event_handlers[i]['contexts']) {
                $(_eventBox).off("CONTEXT" + _event_handlers[i]['contexts'][c], _event_handlers[i]['contextHandler']);
            }
        }

        //Empty the array
        _event_handlers.splice(0, _event_handlers.length);

    };

    _self.data.clear = function() {

        //Stop all the observes
        _self.data.stopAllObserves();

        //Clear the resources contexts storage
        for(var key in _resourcesContexts) {
            delete _resourcesContexts[key];
        }

    };

    /**
     * Updates the context with the given data.
     * @param contextId String
     * @param contextData An object with the params to update. A param value of null means to delete the param from the
     * context, i.e the following sequence os updateContext with data {uid: 1, max:5, pid: 2} and {pid: 3, max:null}
     * will result in the following context: {uid: 1, pid:3}
     */
    _self.data.updateContext = function updateContext(contextId, contextData) {

        if('string' !== typeof contextId) {
            error("Method 'updateRange' requires a string for contextId param.");
            return;
        }

        if(_resourcesContexts[contextId] == null) {
            initializeContext(contextId);
        }

        //Update values of the context (if null, remove it)
        var hasChanged = false;
        var changes = {};

        var setChange = function(name, newValue) {
            hasChanged = true;
            changes[name] = newValue;
        };

        for(var name in contextData) {

            //Check if that parameter exists. If not, ignore it
            if(_existentParametersList.indexOf(name) === -1) {
                warn("Parameter '" + name + "' given in updateContext does not exist.");
                continue;
            }

            var newValue = contextData[name];
            var oldValue = _resourcesContexts[contextId]['data'][name];

            // Save the changes
            if(newValue instanceof Array && oldValue instanceof Array ) { //Check if multiparameter arrays are identical

                if(newValue.length != oldValue.length) {
                    setChange(name, newValue);
                }

                //Check all the values inside the array
                for(var i = 0; i < newValue.length; ++i) {
                    if(newValue[i] != oldValue[i]){
                        setChange(name, newValue);
                        break;
                    }
                }
            } else if(newValue != oldValue) {
                    setChange(name, newValue);
            }

            //Change the context
            if(newValue != null && newValue != oldValue && (!(newValue instanceof Array) || newValue.length > 0)) {
                _resourcesContexts[contextId]['data'][name] = newValue;
            } else if((newValue == null && oldValue != null) || (newValue instanceof Array && newValue.length === 0)) {
                delete _resourcesContexts[contextId]['data'][name];
            }
        }

        //Trigger an event to indicate that the context has changed
        if(hasChanged) {
            _resourcesContexts[contextId].updateCounter++;
            $(_eventBox).trigger("CONTEXT" + contextId, [_resourcesContexts[contextId].updateCounter, changes, contextId]);
        }


    };

    /**
     * Sets the dashboard controller for the framework.
     * @param controller
     */
    _self.dashboard.setDashboardController = function setDashboardController(controller) {
        _dashboardController = controller;
    };

    /**
     * Registers a new widget in this dashboard
     * @param newDashboard Widget object.
     */
    _self.dashboard.registerWidget = function registerWidget(widget) {
        if(_dashboardController != null && _dashboardController.registerWidget != null) {
            _dashboardController.registerWidget(widget);
        } else {
            warn("Dashboard controller has no registerWidget method.");
        }
    };

    /**
     * Changes the current dashboard
     * @param newDashboard Id of the new dashboard to visualize.
     * @param env Environment object. This contains all the information of the environment that the new dashboard will need.
     */
    _self.dashboard.changeTo = function changeTo(newDashboard, env) {

        if(_dashboardController != null && _dashboardController.changeTo != null) {

            //Ask the dashboard controller to change the dashboard
            _dashboardController.changeTo(newDashboard, function() {

                //Dashboard controller is now ready to change the dashboard, so we need to change the env
                _dashboardEnv = ( typeof env === 'object' ? env : {} );

                //Execute change listeners
                for(var i = 0; i < _dashboardEventListeners['change'].length; ++i) {
                    if(typeof _dashboardEventListeners['change'][i] === 'function') {
                        _dashboardEventListeners['change'][i]();
                    }
                }
            });
        } else {
            error("Dashboard controller has no changeTo method.");
        }
    };

    /**
     * Gets the dashboard environment
     */
    _self.dashboard.getEnv = function getEnv() {
        return clone(_dashboardEnv) || {}; // TODO: optimize?
    };

    /**
     * Add events to the dashboard. Event available:
     * - change: executed when the dashboard is changed. This is also fired with the initial dashboard.
     * @param event
     * @param callback
     */
    _self.dashboard.addEventListener = function(event, callback) {

        if(event === 'change' && typeof callback === 'function') {
            _dashboardEventListeners['change'].push(callback);
        }

    };

    /**
     * Removes an event from the dashboard.
     * @param event
     * @param callback
     */
    _self.dashboard.removeEventListener = function(event, callback) {

        if(event === 'change') {
            for(var i = _dashboardEventListeners['change'].length - 1; i >= 0; --i) {
                if(_dashboardEventListeners['change'][i] === callback) {
                    _dashboardEventListeners['change'].splice(i,1);
                }
            }
        }

    };


    /*
     --------------------------------
     --- FRAMEWORK INITIALIZATION ---
     --------------------------------
     */

    /**
     * Method that makes the initial checks to determine if the framework can be initialized
     * @returns {boolean}
     */
    var frameworkPreCheck = function frameworkPreCheck(){

        /* CHECK SHD-API SERVER URL */
        if(typeof SDH_API_URL === 'undefined'){
            error("SDH_API_URL global variable must be set with the url to the SDH-API server.");
            return false;
        }

        _serverUrl = SDH_API_URL.trim();

        if(_serverUrl.length === 0) {
            error("SDH_API_URL global variable must be set with a valid url to the SDH-API server.");
            return false;
        }
        if(_serverUrl.substr(-1) === '/') {
            _serverUrl = _serverUrl.substr(0, _serverUrl.length - 1);
        }

        /* CHECK JQUERY */
        if (typeof jQuery == 'undefined') {
            error("SDH Framework requires JQuery to work properly.");
            return false;
        }

        return true;
    };

    /**
     * Add a callback that will be executed when the framework is ready
     * @param callback
     */
    var frameworkReady = function frameworkReady(callback) {
        if(!_isReady && typeof callback === 'function') {
            $(_eventBox).on("FRAMEWORK_READY", function() {
                $(_eventBox).off("FRAMEWORK_READY");
                callback();
            });
        } else if(typeof callback === 'function') {
            callback();
        }
    };

    var isFrameworkReady = function isFrameworkReady() {
        return _isReady;
    };

    var frameworkInit = function frameworkInit() {

        if(frameworkPreCheck()) {

            loadResourcesInfo(function(){

                window.framework.data = _self.data;
                window.framework.dashboard = _self.dashboard;

                _isReady = true;
                $(_eventBox).trigger("FRAMEWORK_READY");
            });

            window.framework = {
                data: {},
                widgets: {},
                dashboard: {},
                ready: frameworkReady, /* Method to add a callback that will be executed when the framework is ready */
                isReady: isFrameworkReady
            };

            // AMD compliant
            if ( typeof define === "function" && define.amd) {
                define( [], function () { return window.framework; } );
            }

        }

    };

    frameworkInit();

})();