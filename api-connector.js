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
     * Fills _resourcesInfo hashmap with the reources info and the following structure:
     * {
     *       "{resource-id}": {
     *           path:"yourpath/../sdfsdf",
     *           params: ['param1', 'param2'],
     *           queryParams: ['queryParam1']
     *       },
     *       ...
     *   }
     * Also fill the _existentParametersList array with each resource parameter name.
     * @param onReady
     */
    var loadApiResourcesInfo = function loadApiResourcesInfo(requestJSON, onReady, onError) {

        var _resourcesInfo = {};
        var _existentParametersList = [];

        requestJSON("/api/", null, function(data) {

            //var paths = data['swaggerjson']['paths'];
            var paths = [{
                path :"/metrics",
                variable: "id"
            },{
                path :"/tbdata",
                variable: "id"
            }];

            var apiPaths = data['swaggerjson']['paths'];

            //Count number of elements in paths
            var pathsLength = 0;
            for(var i in paths) pathsLength++;

            //Function to check if it has finished and call the callback
            var pathsProcessed = 0;
            var pathProcessed = function() {
                if(++pathsProcessed === pathsLength && 'function' === typeof onReady) {
                    onReady({
                        _resourcesInfo: _resourcesInfo,
                        _existentParametersList: _existentParametersList
                    });
                }
            };

            //Initialize the _resourcesInfo object
            _resourcesInfo = {};

            //var isMetricList = /\/data\/$/;
            //var isMetricListWithoutParams = /^((?!\{).)*\/data\/$/;
            //var isSpecificMetric = /\/\{mid\}$/;



            //TODO: Get this information from SDH-API Swagger.json file
            var statInfo = [
                // API static Information description
                { "id" : "userinfo", "path" : "/users/{uid}", params: {'uid': {name: 'uid',in: 'path',required: true}}, "description" : "User Information" },
                { "id" : "repoinfo", "path" : "/repositories/{rid}", params: {'rid': {name: 'rid',in: 'path',required: true}}, "description" : "Repository Information" },
                { "id" : "productinfo", "path" : "/products/{prid}", params: {'prid': {name: 'prid',in: 'path',required: true}}, "description" : "Product Information" },
                { "id" : "projectinfo", "path" : "/projects/{pjid}", params: {'pjid': {name: 'pjid',in: 'path',required: true}}, "description" : "Project Information" },
                { "id" : "orginfo", "path" : "/", "description" : "Organization Information" },
                { "id" : "userlist", "path" : "/users/", "description" : "Users List" },
                { "id" : "productlist", "path" : "/products/", "description" : "Products List" },
                { "id" : "projectlist", "path" : "/projects/", "description" : "Projects List" },
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
                            console.error("General resource path ("+generalResourcePathInfo+") does not exist in API path list.");
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
                }.bind(null, x), 2, onError);


            }

        }, 3, onError);
    };

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [], function () {
            return loadApiResourcesInfo;
        } );
    } else {
        console.error("require.js is needed");
    }

})();

