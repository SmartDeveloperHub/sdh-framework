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
    var _self = { data: {}, widgets: {}, dashboard: {}, utils: {} };

    //Path to the SDH-API server without the trailing slash
    var _serverUrl;

    // SDH API key
    var _serverKey;

    // Array with the information about the different resources of the API
    var _resourcesInfo;

    // List of all the parameters that can be used with the API.
    // It is only for performance purposes while checking input.
    var _existentParametersList = [];

    var _resourcesContexts = {};

    // Contains a list that links user callbacks (given as parameter at the observe methods) with the internal
    // callbacks. It is need to remove handlers when not used and free memory.
    var _event_handlers = {};

    // This is a variable to make the events invisible outside the framework
    var _eventBox = {};

    // Dashboard controller
    var _dashboardController = null;

    var _dashboardEnv = {};

    // This contains the listeners for each of the events of the dashboard
    var _dashboardEventListeners = {
        'change' : []
    };

    //Next observe id (this is the id to assign to the next observe method)...This should be autoincremented
    var _nextObserveId = 0;

    //Next request id (this is the id of a http request)...This should be autoincremented
    var _nextRequestId = 0;

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
     * Prints a framework error and sends an error event to the observer.
     * @param message
     * @param callback
     */
    var errorWithObserve = function(message, callback) {
        error(message);
        sendErrorEventToCallback(message, callback);
    };

    /**
     * Prints a framework warning
     * @param message Message to display.
     */
    var warn = function warn(message) {
        console.warn("[" + FRAMEWORK_NAME +  "] " + message);
    };


    var requestJSON = function requestJSON(path, queryParams, callback, maxRetries, onError) {

        if(typeof maxRetries === 'undefined'){
            maxRetries = 2; //So up to 3 times will be requested
        }

        var xhr = $.ajax({
            dataType: "json",
            url: _serverUrl + path,
            data: queryParams,
            success: callback,
            method: "GET",
            beforeSend: function( xhr ) {
                if(_serverKey != null) {
                    xhr.setRequestHeader("Authorization", "Bearer " + _serverKey);
                }

            }
        }).fail( function(jqxhr, textStatus, e) {

            // Handle authentication error
            if(jqxhr.statusCode() == 401) {
                if(_dashboardController != null && _dashboardController['authenticationError'] != null) {
                    _dashboardController.authenticationError();
                }
                console.log("Authentication error");
                return;
            }

            //Retry the request
            if (maxRetries > 0 && textStatus === "timeout") {
                requestJSON(path, queryParams, callback, --maxRetries);
            } else {
                if(e != "abort") {
                    error("Framework getJSON request failed\nStatus: " + textStatus + " \nError: "+ (e ? e : '-') + "\nRequested url: '"+
                        path+"'\nParameters: " + JSON.stringify(queryParams));
                }

                if(typeof onError === 'function') {
                    onError(e);
                }
            }

        });

        return xhr;

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
     * param observeId
     * @param resourceId
     * @param params Parameters of the request
     * @param callback Callback to execute when the response is retrieved (or when an error happened, in which case the
     *                  data returned in the callback will be null)
     */
    var makeResourceRequest = function makeResourceRequest(observeId, resourceId, params, callback) {

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

            //Obtain an id for the request
            var requestId = _nextRequestId++;

            // Make the request. Once it has finished, remove it from the pending requests
            var xhr = requestJSON(
                path,
                queryParams,
                function(data) { //Success
                    delete _event_handlers[observeId]['pendingRequests'][requestId];
                    callback(data)
                },
                0,
                function(e) { //In case of error return null
                    delete _event_handlers[observeId]['pendingRequests'][requestId];
                    if(e != "abort") {
                        callback(null);
                    }
                }
            );

            // Store the pending request
           _event_handlers[observeId]['pendingRequests'][requestId] = xhr;

        } else {
            error("Resource '"+ resourceId + "' does not exist.");
            callback(null);
        }

    };

    /**
     * Requests multiple resources
     * @param resources Normalized resource
     * @param observeId
     * @param unique Is this is a request that do not depend on any context, so it will be executed only once
     */
    var multipleResourcesRequest = function multipleResourcesRequest(resources, observeId, unique) {

        var completedRequests = 0;
        var allData = {};
        var requests = [];
        var responses = [];
        var requestGroupId = 0; //This id is used to identify groups of requests, that is for example a request that contains
                                // multiparameters...So a group can be composed of multiple requests.
        var groupInfo = []; //This array contains all the information needed for each post-aggregator having as index
                            // the group id. That is:
                            // - resourceId: the id of the resource that is requested by the request group
                            // - postAggregator: post-aggregator function
                            // - postModifier: post-modifier function
                            // - responses: all the responses that belong to the request group
                            // - originalParams: the parameters of the request group (that is the request before expanding it)

        // Callback to the user when the framework has new information about the observe
        var callback = _event_handlers[observeId].userCallback;

        // Cancel the previous pending requests of that observer
        cancelPendingObserveRequests(observeId);

        /**
         *
         * @param resourceId
         * @param groupId
         * @param params
         * @param postModifier
         * @param requestOrder Index of the request. Is needed to then process the responses in the same order they
         *          were requested.
         * @param data
         */
        var waitAndReorderResources = function(resourceId, groupId, params, postModifier, requestOrder, data) {

            // Store the responses
            responses[requestOrder] = [resourceId, groupId, params, postModifier, data];

            // When all the responses have been retrieved, process each of them
            if(++completedRequests === requests.length) {
                completedRequests = 0; //Reset for the next method
                for(var r = 0; r < responses.length; r++) {
                    if(responses[r] != null) {
                        processResourceResponse.apply(null, responses[r]);
                    }
                }
            }
        };

        /**
         * Process responses and send data when all responses have been retrieved and processed
         * @param resourceId
         * @param groupId
         * @param params
         * @param postModifier Function to be executed after post aggregator (if is set) and before sending the data in
         *          order to modify the data to send. Null if the post modifier is not defined.
         * @param data
         */
        var processResourceResponse = function(resourceId, groupId, params, postModifier, data) {

            if(data == null) {
                sendErrorEventToCallback("An error occurred while requesting resource " + resourceId, callback);
                return;
            }

            if(allData[resourceId] == null) {
                allData[resourceId] = [];
            }

            // Add the framework info to the data received from the api
            var resUID = _self.utils.resourceHash(resourceId, params);
            var info = {
                UID: resUID,
                request: {
                    params: params
                }
            };

            var response = {
                data: data,
                info: info
            };

            // If it has to be post-aggregated don't add it to the allData, add it to an special list to be processed
            // when all the requests have finished
            if(groupInfo[groupId] != null) {

                // Push all the responses that belongs to that post aggregator
                groupInfo[groupId]['responses'].push(response);

            } else {

                // Execute post modifier
                if(typeof postModifier === 'function') {
                    response = postModifier(response);
                }

                allData[resourceId].push(response);
            }


            // All the responses have been processed
            if(++completedRequests === requests.length) {

                // Process all the post aggregators (allData is modified)
                processPostMethodsInAllData(groupInfo, allData);

                // Finally sent all the responses to the callback
                sendDataEventToCallback(allData, callback, unique);
            }
        };

        //Send a loading data event to the listener
        sendLoadingEventToCallback(callback);

        for(var i in resources) {

            var resourceId = resources[i].id;
            var params = {};
            var multiparams = [];
            var postAggrFunction = null;
            var postModifier = null;

            //Fill the params and multiparams and check post aggregators
            for(var name in resources[i]) {

                if(_resourcesInfo[resourceId]['optionalParams'][name] != null || _resourcesInfo[resourceId]['requiredParams'][name] != null) { //Is a param

                    //Check if is multi parameter and add it to the list of multi parameters
                    if(resources[i][name] instanceof Array) {
                        multiparams.push(name);
                    }

                    params[name] =  resources[i][name];

                } else if(name === 'post_aggr') { //The post aggregator is a function that is executed before the callback
                                                  // to make grouping operations on request groups.

                    var postAggrVal = resources[i][name];

                    // Post aggregator can be an string which is a predefined agregator that the framework defines
                    if(typeof postAggrVal === 'string') {
                        switch (postAggrVal) {
                            case 'sum':
                                postAggrFunction = sumPostAggregator;
                                break;
                            case 'avg':
                                postAggrFunction = avgPostAggregator;
                                break;
                        }

                    // The post aggregator can also be a custom function defined by the user to be called before the
                    // the callback is executed.
                    } else if(typeof postAggrVal === 'function') {
                        postAggrFunction = postAggrVal;
                    }

                } else if(name === 'post_modifier' && typeof resources[i][name] === 'function') {
                    postModifier = resources[i][name];
                }

            }

            //If it had a post-aggregator we have to save some information about the group
            if(postAggrFunction != null) {
                groupInfo[requestGroupId] = {
                    resourceId: resourceId,
                    postAggregator: postAggrFunction,
                    postModifier: postModifier,
                    responses: [],
                    originalParams: params
                };
            }

            var requestsCombinations = generateResourceRequestParamsCombinations(resourceId, params, multiparams, requestGroupId);
            requests = requests.concat(requestsCombinations);

            // Next group id
            requestGroupId++;

        }

        for(var i = 0; i< requests.length; i++) {
            var resourceId = requests[i]['resourceId'];
            var params = requests[i]['params'];
            var groupId = requests[i]['groupId'];
            var resourceReadyCallback = waitAndReorderResources.bind(undefined, resourceId, groupId, params, postModifier, i);

             makeResourceRequest(observeId, resourceId, params, resourceReadyCallback);
        }

    };

    /**
     * This method cancels all the pending requests that are being done to satisfy an observer
     * @param observeId
     */
    var cancelPendingObserveRequests = function(observeId) {

        if(_event_handlers[observeId] != null && _event_handlers[observeId]['pendingRequests'] != null) {

            for(var requestId in _event_handlers[observeId]['pendingRequests']) {
                _event_handlers[observeId]['pendingRequests'][requestId].abort();
                delete _event_handlers[observeId]['pendingRequests'][requestId];
            }

        }

    };

    /**
     * Creates an skeleton of response for a request group. This skeleton is filled by the post aggregator.
     * @param group
     * @returns {{data: {values: Array, info: Object}, info: {UID, request: {params: *}}}}
     */
    var createPostAggregatorResponseSkeleton = function(group) {

        var resourceId = group['resourceId'];
        var groupRequests = group['responses'];
        var groupParams = group['originalParams'];

        //Remove the extra info that the API can send about the parameters
        var data_info = clone(groupRequests[0]['data']['info']);
        for(var i = data_info['params'].length - 1; i >= 0; i--) {
            delete data_info[data_info['params'][i]];
        }

        return {
            data: {
                values: [],
                info: data_info
            },
            info: {
                UID: _self.utils.resourceHash(resourceId, groupParams),
                request: {
                    params: groupParams
                }
            }
        };

    };

    /**
     * This method executes the post aggregator and post modifier in the request groups that have them defined.
     * It modifies the allData parameter to add an entry for each request group (the combination of responses of that
     * group)
     * @param groupInfo Information of the request group.
     * @param allData Hashmap to be returned to the observe callback. Note: This parameter is modified by reference
     */
    var processPostMethodsInAllData = function(groupInfo, allData) {

        for(var grid = 0; grid < groupInfo.length; grid++) {

            var group = groupInfo[grid];

            if(group != null) {

                //Create the framework "response" skeleton that the post aggregator can use to simplify its job
                var responseSkel = createPostAggregatorResponseSkeleton(group);

                try {
                    var result = group['postAggregator'](group['responses'], responseSkel); //Execute post-aggr
                    if(typeof group['postModifier'] === 'function') {
                        result = group['postModifier'](result);
                    }
                    allData[group['resourceId']].push(result);
                }catch(e) {
                    error("Error while executing post aggregator: " + e);
                }

            }
        }

    };

    /**
     * Generates an array of requests combining all the values of the multi parameters (param and queryParam).
     * @param resourceId
     * @param params Hash map of param name and values.
     * @param multiparam List of parameter names that have multiple values.
     * @param groupId Id of the group the requests belong to. This is usefull to determine after expanding a multiparameter
     *          to which request group it belongs.
     * @returns {Array} Array of requests to execute for one resource
     */
    var generateResourceRequestParamsCombinations = function (resourceId, params, multiparam, groupId) {

        var paramsCombinations = generateParamsCombinations(params, multiparam);
        var allCombinations = [];

        //Create the combinations of params and queryParams
        for(var i = 0, len_i = paramsCombinations.length; i < len_i; ++i) {
            allCombinations.push({
                resourceId: resourceId,
                params: paramsCombinations[i],
                groupId: groupId
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
        var specialParameters = ['id', 'static', 'post_aggr', 'post_modifier'];

        for(var i = 0; i < resources.length; ++i) {
            var resource = resources[i];
            var resourceId = resource['id'];
            var resourceInfo = _resourcesInfo[resourceId];

            if(resourceInfo == null) {
                warn("Resource '"+resourceId+"' does not exist.");
            } else { //Check its parameters
                var cleanParameters = {};
                for(var paramName in resource) {
                    if(specialParameters.indexOf(paramName) === -1 && resourceInfo['requiredParams'][paramName] == null && resourceInfo['optionalParams'][paramName] == null) {
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

            // Check if it still is being observed
            var observed = false;
            if(!unique) {
                for (var observeId in _event_handlers) {
                    if (_event_handlers[observeId].userCallback === callback) {
                        observed = true;
                        break;
                    }
                }
            } else {
                observed = true;
            }

            // If it is still being observe, send the data to the callback
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

    /**
     * Sens an error event to the given observer.
     * @param msg Text to display
     * @param callback
     */
    var sendErrorEventToCallback = function sendErrorEventToCallback(msg, callback) {
        callback({
            event: "error",
            msg: msg
        });
    };

    /**
     * This post aggreator makes the summation of all the values of the responses of a request group.
     * @param responses List of framework responses to a group request (all the requests that appear after expanding all
     *                  the multiparameters).
     * @param skel The framework builds a response with an empty data property, which the post aggregator should fill.
     * @returns {*} The framework response.
     */
    var sumPostAggregator = function sumPostAggregator(responses, skel) {

        var sum = 0;
        for(var i = 0; i < responses.length; ++i, sum += vSum) {
            var values = responses[i]['data']['values'];
            for(var x = 0, vSum = 0; x < values.length; vSum += values[x++]);
        }

        skel['data']['values'] = [sum];

        return skel;

    };

    /**
     * This post aggregator calculates the average of all the values of the responses of a request group.
     * @param responses List of framework responses to a group request (all the requests that appear after expanding all
     *                  the multiparameters).
     * @param skel The framework builds a response with an empty data property, which the post aggregator should fill.
     * @returns {*} The framework response.
     */
    var avgPostAggregator = function avgPostAggregator(responses, skel) {

        var sum = 0;
        var count = 0;
        for(var i = 0; i < responses.length; ++i, sum += vSum) {
            var values = responses[i]['data']['values'];
            for(var x = 0, vSum = 0; x < values.length; vSum += values[x++], count++);
        }

        skel['data']['values'] = [sum / count];

        return skel;

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
     *                   uid: [1, 2, 3], //This is a multiparameter. The framework expands automatically this request
     *                                   //called "request group" to simple requests.
     *                   from :  new Date(),
     *                   max: 0,
     *                   post_aggr: "sum",  //Post aggregator is executed after retrieving all the simple request of a
     *                                      //request group in order to combine them into a single response.
     *                                      //Note that the use of a post_aggr is not compulsory with multiparameters.
     *                   post_modifier: function(resource) {} //Function executed after the post_aggr (if any)
     *                                      //to modify an individual response.
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

        if('function' !== typeof callback) {
            throw new Error("Method 'observeData' requires a valid callback function.");
        }

        if(!Array.isArray(resources) || resources.length === 0 ) {
            errorWithObserve("Method 'observeData' has received an invalid resources parameter.", callback);
            return;
        }

        if(contextIds != null && !(contextIds instanceof Array) ) {
            errorWithObserve("Method 'observeData' expects contextIds parameter to be null or an array.", callback);
            return;
        }

        //Normalize the array of resources
        resources = normalizeResources(resources);

        if(resources.length === 0) {
            errorWithObserve("No resources to observe.", callback);
            return;
        }

        //Check that static parameters have their value defined in the resource
        for(var i = 0; i < resources.length; ++i) {
            if(resources[i]['static'] != null && resources[i]['static'].length > 0) {
                for(var s = 0; s < resources[i]['static'].length; ++s) {
                    var staticParam = resources[i]['static'][s];
                    if(resources[i][staticParam] == null) {
                        errorWithObserve("Static parameter '"+staticParam+"' must have its value defined.", callback);
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

        //The id assigned to this observe
        var observeId = _nextObserveId;

        //If contexts are defined, combine the resources with the context in order to create more complete resources that could
        // be requested.
        if(contextIds.length > 0) {

            //Combine the resources with the context in order to create more complete resources that could be requested.
            var resourcesWithContext = combineResourcesWithContexts(resources, contextIds);

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
                    multipleResourcesRequest(resourcesWithContext, observeId, false);
                }
            };

            // Create the CONTEXT event listener for each of the contexts
            for(var c in contextIds) {
                $(_eventBox).on("CONTEXT" + contextIds[c], contextEventHandler);
            }

            //Store information about the observe
            _event_handlers[observeId] = {
                userCallback: callback,
                contexts: contextIds,
                contextHandler: contextEventHandler,
                pendingRequests: {}
            };

            //Increment the id of the next one
            _nextObserveId++;

            //Request all the resources if possible
            if(allResourcesCanBeRequested(resourcesWithContext)) {
                multipleResourcesRequest(resourcesWithContext, observeId, false);
            }

        } else { //No context is set

            //Request all the resources
            if(allResourcesCanBeRequested(resources)) {

                //Store information about the observe (this one does not have contextHandler because it has no contexts)
                _event_handlers[observeId] = {
                    userCallback: callback,
                    contexts: [],
                    pendingRequests: {}
                };

                //Increment the id of the next one
                _nextObserveId++;

                multipleResourcesRequest(resources, observeId, true);

            } else {
                errorWithObserve("Some of the resources have not information enough for an 'observe' without context or does not exist.", callback);
            }
        }

    };

    /**
     * Cancels observing for an specific callback
     * @param callback The callback that was given to the observe methods
     */
    _self.data.stopObserve = function stopObserve(callback) {
        for (var observeId in _event_handlers) {
            if(_event_handlers[observeId].userCallback === callback) {

                //Stop its pending requests
                cancelPendingObserveRequests(observeId);

                for (var c in _event_handlers[observeId]['contexts']) {
                    $(_eventBox).off("CONTEXT" + _event_handlers[observeId]['contexts'][c], _event_handlers[observeId]['contextHandler']);
                }
                delete _event_handlers[observeId];
            }
        }
    };

    /**
     * Cancels observing for everything.
     */
    _self.data.stopAllObserves = function stopAllObserves() {

        //Remove all the event handlers
        for (var observeId in _event_handlers) {

            //Stop its pending requests
            cancelPendingObserveRequests(observeId);

            for (var c in _event_handlers[observeId]['contexts']) {
                $(_eventBox).off("CONTEXT" + _event_handlers[observeId]['contexts'][c], _event_handlers[observeId]['contextHandler']);
            }
        }

        //Empty the object
        delete _event_handlers[observeId];

    };

    /**
     * Stops all the observers and clears contexts.
     */
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
            error("Method 'updateContext' requires a string for contextId param.");
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
                _resourcesContexts[contextId]['data'][name] = clone(newValue);
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
     * Observe changes in a context.
     * @param contextId Id of the context to observe.
     * @param callback Function that receives the new data of the context, the list of changes produced and the contextId.
     */
    _self.data.observeContext = function observeContext(contextId, callback) {

        if('string' !== typeof contextId) {
            error("Method 'observeContext' requires a string for contextId param.");
            return;
        }

        if(_resourcesContexts[contextId] == null) {
            initializeContext(contextId);
        }


        var contextEventHandler = function(event, contextCounter, contextChanges, contextId) {

            //If it is not the last context event launched, ignore the data because there is another more recent
            // event being executed
            if(contextCounter != _resourcesContexts[contextId]['updateCounter']) {
                return;
            }

            callback(clone(_resourcesContexts[contextId].data), contextChanges, contextId);


        };

        _event_handlers[_nextObserveId] = {
            userCallback: callback,
            contexts: [ contextId ],
            contextHandler: contextEventHandler
        };

        //Increment the id of the next one
        _nextObserveId++;

        // Create the CONTEXT event listener
        $(_eventBox).on("CONTEXT" + contextId, contextEventHandler);

    };

    /**
     * Gets the data stored in a given context.
     * @param contextId Id of the context
     * @returns {*}
     */
    _self.data.getContextData = function getContextData(contextId) {

        if('string' !== typeof contextId) {
            error("Method 'observeContext' requires a string for contextId param.");
            return;
        }

        if(_resourcesContexts[contextId] != null) {
            return clone(_resourcesContexts[contextId].data);
        } else {
            return null;
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
     * @param category View selection info. This optional parameter allows to have different views for a dashboard
     *          depending on the category. It is an object with 'category' and 'value'.
     */
    _self.dashboard.changeTo = function changeTo(newDashboard, env, category) {

        if(_dashboardController != null && _dashboardController.changeTo != null) {

            env = ( typeof env === 'object' ? env : {} );

            //Ask the dashboard controller to change the dashboard
            _dashboardController.changeTo(newDashboard, env, category, function() {

                //Dashboard controller is now ready to change the dashboard, so we need to change the env
                _dashboardEnv = env;

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
     * @param paramName Optional. Get that specific variable in the environment.
     */
    _self.dashboard.getEnv = function getEnv(paramName) {

        if(typeof paramName === 'undefined') {
            return clone(_dashboardEnv) || {}; // TODO: optimize?
        } else {
            var val = _dashboardEnv[paramName];
            return (typeof val === 'object' ? clone(val) : val);
        }

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

    /**
     * Calculate the hash of a resource.
     * @param resourceId Id of the resource
     * @param requestParams Parameters of the resource request.
     * @returns {string} Hash of the resource. If resource does not exist, undefined will be returned.
     */
    _self.utils.resourceHash = function resourceHash(resourceId, requestParams){
        //TODO: loadResourcesInfo should set the list  of hasheable parameters

        if(_resourcesInfo[resourceId] != null) {

            var str = resourceId;
            var hasheable = "";
            for(var i in _resourcesInfo[resourceId]['requiredParams']){
                var param = _resourcesInfo[resourceId]['requiredParams'][i]['name'];
                hasheable += param  + requestParams[param] + ";"
            }

            if(requestParams['aggr'] != null) {
                hasheable += 'aggr'  + requestParams['aggr'] + ";"
            }

            return resourceId + "#" + hashCode(hasheable).toString(16);

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

        if(typeof SDH_API_KEY === 'string') {
            _serverKey = SDH_API_KEY.trim();
        } else {
            _serverKey = null;
            warn("SDH Framework is working without an SDH API KEY!");
        }

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

    var frameworkInit = function frameworkInit(_loadResourcesInfo) {

        if(frameworkPreCheck()) {

            window.framework = {
                data: {},
                widgets: {},
                dashboard: {},
                utils: {},
                ready: frameworkReady, /* Method to add a callback that will be executed when the framework is ready */
                isReady: isFrameworkReady
            };

            _loadResourcesInfo(requestJSON, function(info) {

                // Store the API info in the variables
                _resourcesInfo = info._resourcesInfo;
                _existentParametersList = info._existentParametersList;

                window.framework.data = _self.data;
                window.framework.dashboard = _self.dashboard;
                window.framework.utils = _self.utils;

                _isReady = true;
                $(_eventBox).trigger("FRAMEWORK_READY");

            }, function(e) { //An error happened
                _isReady = false;
                $(_eventBox).off("FRAMEWORK_READY");
                $(window).trigger("FRAMEWORK_INITIALIZATION_ERROR", e);
            });

        }

    };

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( "sdh-framework", [
            './api-connector',
            'jquery'
        ], function (_loadResourcesInfo) {
            frameworkInit(_loadResourcesInfo);
            return window.framework;
        } );
    } else {
        frameworkInit(_loadResourcesInfo);//The method should be saved in a global.The recommended usage is with requirejs
    }

})();