# sdh-framework
The aim of this framework is to facilitate the acquisition of data from an API and the creation of dashboards to visualize that information.

##Components of the framework
 - Base Layer: this layer, that corresponds to the framework.js file, is the core of the framework. It provides the basic functionality to obtain data from the API and control the dashboards.
 - Widgets: the framework is designed to be extensible with widgets. This widgets, that must "implement" a simple interface, can register themselves in the framework in order to be used by the dashboard developer.
 
##How to connect with your own API

In order to connect this framework with your own API you just have to:
  1. Create a Javascript global variable SDH_API_URL with the URL of your API server.
  2. Edit the loadResourcesInfo method in framework.js to adapt it to your API structure. That method must:
    1. Add each new resource parameter name to the _existentParametersList array (this is like a cache of the parameters that can be used in the API, needed for performance reasons).
    2. Fill the _resourcesInfo private variable with information for each API resource.  It must have the following structure:
```javascript
      resourcesInfo[<String:resourceId>] = {
        path: <String:resourceRelativePath>,
        requiredParams: { //list of required parameters
          <String:paramName>: {
            name: <String:paramName>,
            in: <"query" or "path">,
            required: true
          };
        }, 
        optionalParams: { //list of optional parameters
          <String:paramName>: {
            name: <String:paramName>,
            in: <"query" or "path">,
            required: false
          };
        }
      };
```
    
## How to create a new widget
Just create a new file based on the following template.
```javascript
(function() {

    /* MySampleWidget constructor
    *   element: the DOM element that will contain the widget
    *   resources: resources to observe
    *   contexts: list of contexts
    *   configuration: you can use his optional parameter to assing a custom widget configuration.
    */
    var MySampleWidget = function MySampleWidget(element, resources, contextId, configuration) {

        //TODO: your code here

        // extending widget
        framework.widgets.CommonWidget.call(this, false, element);

        // Use the callback offered by widget.common
        this.observeCallback = this.commonObserveCallback.bind(this);

        framework.data.observe(resources, this.observeCallback , contexts);

    };

    MySampleWidget.prototype = new framework.widgets.CommonWidget(true);

    MySampleWidget.prototype.updateData = function(framework_data) {
        //TODO: your code here
    };

    MySampleWidget.prototype.delete = function() {
    
        //Stop observing for data changes
        framework.data.stopObserve(this.observeCallback);

        //TODO: your code here

    };
    
    // Register the widget in the framework
    window.framework.widgets.MySampleWidget = MySampleWidget;

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [ /* List of dependencies */ ], function () { return MySampleWidget; } );
    }

})();
```
