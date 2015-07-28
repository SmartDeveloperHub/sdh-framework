# sdh-framework
The aim of this framework is to facilitate the acquisition of data from an API and the creation of dashboards to visualize that information.

##Components of the framework
 - Base Layer: this layer, that corresponds to the framework.js file, is the core of the framework. It provides the basic functionality to obtain data from the API and control the dashboards.
 - Widgets: the framework is designed to be extended with widgets. These widgets, that must "implement" a simple interface, can register themselves in the framework in order to be used by the dashboard developer.
 
##How to connect with your own API

In order to connect this framework with your own API you just have to:
  1. Create a Javascript global variable *SDH_API_URL* with the URL of your API server.
  2. Edit the *loadResourcesInfo* method in framework.js to adapt it to your API structure. That method must:
    1. Add each new resource parameter name to the *_existentParametersList* array (this is like a cache of the parameters that can be used in the API, needed for performance reasons).
    2. Fill the *_resourcesInfo* private variable with information for each API resource.  It must have the following structure:
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

        // Extending widget
        framework.widgets.CommonWidget.call(this, false, element);

        // Use the callback offered by widget.common
        this.observeCallback = this.commonObserveCallback.bind(this);

        framework.data.observe(resources, this.observeCallback, contexts);

    };

    MySampleWidget.prototype = new framework.widgets.CommonWidget(true);

    MySampleWidget.prototype.updateData = function(framework_data) {
        //TODO: your code here
    };

    MySampleWidget.prototype.delete = function() {
    
        // Stop observing for data changes
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
## Public methods
The framework is accessible through a global variable (registered in the window Javascript variable) named *framework*. Threrefore, if you want to use some method of the framework, you just have to write *framework.methodname*. This is a list of the available public methods:
- frameworkReady: Add a callback that will be executed when the framework is ready.
- isFrameworkReady: Checks if the framework is ready returning true in that case.
- data.observe: Observes a list of resources depending on a list of contexts.
- data.updateContext: Updates a context with the given data.
- data.stopObserve: Cancels observing for an specific callback.
- data.stopAllObserves: Cancels all the active observes.
- data.clear: Stops all the observes and disposes all the contexts.
- dashboard.setDashboardController: Sets the dashboard controller for the framework.
- dashboard.registerWidget: Registers a new widget in the current dashboard.
- dashboard.changeTo: Changes the current dashboard.
- dashboard.getEnv: Gets the dashboard environment.
- dashboard.addEventListener: Add event listeners to the dashboard. Currently there is only the 'change' event.
- dashboard.removeEventListener: Removes an event listener from the dashboard.

*For more information about their parameters and return values, see the documentation inside the framework.js source file.*
