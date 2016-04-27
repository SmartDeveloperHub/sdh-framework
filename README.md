# sdh-framework
The aim of this framework is to facilitate the acquisition of data from an API and the creation of dashboards to visualize that information.

##Components of the framework
 - Base Layer: this layer, that corresponds to the framework.js file, is the core of the framework. It provides the basic functionality to obtain data from the API and control the dashboards.
 - Widgets: the framework is designed to be extended with widgets. These widgets, that must "implement" a simple interface, can register themselves in the framework in order to be used by the dashboard developer.
 
##How to connect with your own API

In order to connect this framework with your own API you just have to:
  1. Create a Javascript global variable *SDH_API_URL* with the URL of your API server.
  2. Edit the *loadApiResourcesInfo* method in api-connector.js to adapt it to your API structure. That method must:
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
    
## How to use the framework

Before trying to use the framework, make sure that you have done the steps in the "How to connect with your own API" section.
To create your first visualization of metrics follow the following steps:
  1 - Install bower (http://bower.io/)
  2 - Install framework dependencies with bower: `bower install`
  3 - Now you need to configure require.js (http://requirejs.org/docs/api.html#config) to define the shims, paths to the dependencies, etc. 
  Here is an example of configuration (require-config.js).
  
```javascript
require.config({
    baseUrl: PUBLIC_PATH,
    //enforceDefine: true,
    map: {
        '*': {
            'css': 'require-css' // or whatever the path to require-css is
        }
    },
    packages: [
        {
            name: 'sdh-framework',
            location: 'vendor/sdh-framework',
            main: 'framework'
        },
        {
            name: 'datatables',
            location: 'vendor/datatables',
            main: 'media/js/jquery.dataTables.min'
        },
        {
            name: 'bootstrap',
            location: 'vendor/bootstrap',
            main: 'dist/js/bootstrap.min',
            deps: ['jquery']
        },
        {
            name: 'jquery-qtip',
            location: 'vendor/qtip2',
            main: 'jquery.qtip.min' 
        }
    ],
    paths: {
        'require-css': 'vendor/require-css/css',
        'headerHandler': "assets/js/header/headerHandler",
        'widgetCommon': 'vendor/sdh-framework/widgets/Common/common',
        'backbone': 'vendor/backbone/backbone-min',
        'underscore': 'vendor/underscore/underscore-min',
        'd3': "vendor/d3/d3.min",
        'nvd3': "vendor/nvd3/build/nv.d3.min",
        'jquery': 'vendor/jquery/dist/jquery',
        'jquery-ui': 'vendor/jquery-ui/ui',
        'moment': "vendor/moment/moment",
        'lodash': 'vendor/lodash/lodash.min',
        'gridstack': 'vendor/gridstack/dist/gridstack',
        'joint': 'vendor/joint/dist/joint.min',
        'cytoscape': 'vendor/cytoscape/dist/cytoscape',
        'cytoscape-qtip': 'vendor/cytoscape-qtip/cytoscape-qtip',
        'cola': 'vendor/cytoscape/lib/cola.v3.min',
        'chartjs': 'vendor/Chart.js/Chart.min',
        'roboto-fontface': 'vendor/roboto-fontface'
    },
    shim : {
        'nvd3': {
            exports: 'nv',
            deps: ['d3']
        },
        'headerHandler': {
            deps: ['jquery']
        },
        'cytoscape': {
            exports: 'cytoscape',
            deps: ['jquery']
        },
        'cytoscape-qtip': {
            exports: 'cytoscape-qtip',
            deps: ['jquery', 'jquery-qtip', 'cytoscape']
        },
        'cola': {
            exports: 'cola'
        }
    }
});
```

  4 - Load require.js and then dashboard.js from your index.html file adding the following lines between the `<head></head>` tags.

```html
  <script src="vendor/requirejs/require.js"></script>
  <script>
      require(['require-config.js'], function() {
          require(['dashboard.js']);
      });
  </script>
```
  
  5 - Create a file (dashboard.js in this example) that loads the framework and executes your Javascript code.
  
```javascript
    require(["framework" /*, your other dependencies here */], function() {
        framework.ready(function() {
            console.log("Framework ready");
            
            /* Your code to instantiate widgets here!
            Example: 
            var sample_dom = document.getElementById("chart-div");
            var sample_metrics = [
                {
                    id: 'metric_id',
                    // fixed metric parameters
                }
            ];
            var sample_configuration = {
                // Widget configuration
            };
    
            var widget = new framework.widgets.MySampleWidget(sample_dom, sample_metrics, [], sample_configuration);
            */
    
        });
    });
```

## How to create a new widget
Just create a new file based on the following template.
```javascript
(function() {

    var __loader = (function() {

        /* MySampleWidget constructor
        *   element: the DOM element that will contain the widget
        *   resources: resources to observe
        *   contexts: list of contexts
        *   configuration: you can use his optional parameter to assing a custom widget configuration.
        */
        var MySampleWidget = function MySampleWidget(element, resources, contexts, configuration) {
    
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
    
        window.framework.widgets.MySampleWidget = MySampleWidget;
        return MySampleWidget;

    });

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [
            /* List of dependencies */
        ], function () {
            return __loader();
        } );
    } else {
        __loader();
    }

})();
```
For more advanced features provided by the widget.common see the existing widgets in /widgets  directory.

## Public methods
The framework is accessible through a global variable (registered in the window Javascript variable) named *framework*. Threrefore, if you want to use some method of the framework, you just have to write *framework.methodname*. This is a list of the available public methods:
- `frameworkReady(callback)`: Add a callback that will be executed when the framework is ready.
- `isFrameworkReady()`: Checks if the framework is ready returning true in that case.
- `data.observe(resources, obs_callback, contextIds)`: Observes a list of resources depending on a list of contexts.
- `data.stopObserve(obs_callback)`: Cancels observing for an specific callback.
- `data.stopAllObserves()`: Cancels all the active observes.
- `data.clear()`: Stops all the observes and disposes all the contexts.
- `data.updateContext(contextId, contextData)`: Updates a context with the given data.
- `data.getContextData(contextId)`: Gets the data stored in a given context.
- `data.observeContext(contextId, callback)`: Observe changes in a context.
- `dashboard.setDashboardController(controller)`: Sets the dashboard controller for the framework for a multi-dashboard platform.
- `dashboard.registerWidget(widget)`: Registers a new widget in the current dashboard.
- `dashboard.changeTo(newDashboard, env, category)`: Changes the current dashboard.
- `dashboard.getEnv(paramName)`: Gets the dashboard environment. 
- `dashboard.addEventListener(event, callback)`: Add event listeners to the dashboard. Currently there is only the 'change' event.
- `dashboard.removeEventListener(event, callback)`: Removes an event listener from the dashboard.
- `utils.resourceHash(resourceId, requestParams)`: Calculate the hash of a resource.

*For more information about their parameters and return values, see the documentation inside the framework.js source file.*
