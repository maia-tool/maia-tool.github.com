var app = angular.module('maia', ['ui', 'ui.bootstrap', 'maia']);

app.config(function($routeProvider, $locationProvider) {
  $routeProvider.when('/list/:class', {
    templateUrl: 'templates/list.html',
    controller: ListController,
  });

  $routeProvider.when('/matrix/:class', {
    templateUrl: 'templates/matrix.html',
    controller: MatrixController,
  });
  
  $routeProvider.when('/graph/dependency', {
    templateUrl: 'templates/dependency-graph.html',
    controller: DependencyGraphController
  });
  
  $routeProvider.when('/graph/connection', {
    templateUrl: 'templates/connection-graph.html',
    controller: ConnectionGraphController
  });
  
  $routeProvider.when('/graph/composition', {
    templateUrl: 'templates/composition-graph.html',
    controller: CompositionGraphController
  });
  
  $routeProvider.otherwise({
    redirectTo: '/list/agent'
  });
});

try {
  window.model = JSON.parse(localStorage.getItem('data'));
} catch (e) {
  window.model = null;
}

if (!window.model) {
  window.model = { 
    agent: {},
    institution: {},
    entity_action: {},
    plan: {},
    physical_component: {},
    role: {},
    objective: {},
    capability: {},
    entry_condition: {},
    action_situation: {},
    role_enactment: {},
    action_arena: {},
    variable: {},
    problem_domain_variable: {},
    validation_variable: {}
  };
}

app.directive('field', function() {
  return {
    restrict: 'E',
    transclude: true,
    scope: {label: '@', primary: '@'},
    templateUrl: 'templates/field.html'
  };
});

app.directive('textField', function() {
  return {
    restrict: 'E',
    transclude: false,
    priority: 100,
    scope: {label: '@',model: '=',prop: '@',mode: '='},
    templateUrl: 'templates/text-field.html'
  };
});

app.directive('pickField', function() {
  return {
    restrict: 'E',
    transclude: false,
    priority: 100,
    scope: {label: '@',model: '=',prop: '@',options: '@',mode: '='},
    templateUrl: 'templates/pick-field.html'
  };
});


app.directive('selectField', function() {
  return {
    restrict: 'E',
    transclude: false,
    priority: 100,
    scope: {label: '@',model: '=',prop: '@',mode: '=',type: '@',multiple: '@',formatter: '@',creator: '@',creatorDialog: '@',query: '=',maxItems: '@'},
    templateUrl: 'templates/select-field.html'
  };
});


function updateObject(obj, callback) {
  angular.injector(['ng']).invoke(function($rootScope) {
    $rootScope.$apply(function() {
      var id = obj._id || Date.now(), 
      table = model[obj._class] || (model[obj._class] = {}), 
      table = model[obj._class] || (model[obj._class] = {}), 
      tgt = table[id] || (table[id] = {});
      
      if (!obj._id)
        obj._id = id;
      
      if (tgt !== obj) {
        for (var key in tgt)
          if (tgt.hasOwnProperty(key) && 
          !obj.hasOwnProperty(obj))
            delete tgt[key];
        
        for (var key in obj)
          if (obj.hasOwnProperty(key))
            tgt[key] = obj[key];
        
        localStorage.setItem('data', JSON.stringify(model));
      }
      
      callback && callback(tgt);
    });
  });
}

function getObject(id, type) {
  if (!model[type])
    return;
  if (!model[type][id])
    return;
  return model[type][id];
}

/*
app.directive('field', function() {
  return {
  scope: {
    
  },
  template: '<div class="span4">@label</div' +
        '<div class="span8">
        
        
  }
})
*/

function objectValues(obj) {
  var arr = [];
  for (var key in obj)
    obj.hasOwnProperty(key) && arr.push(obj[key]);
  return arr;
}



angular.module('maia').directive('maiaSelect', function($dialog, $parse, $interpolate) {
  return {
    require: '?ngModel',
    compile: function(tElm, tAttrs) {
      var repeatOption, 
      repeatAttr, 
      isSelect = tElm.is('select');

      // Enable watching of the options dataset if in use
      if (tElm.is('select')) {
        repeatOption = tElm.find('option[ng-repeat], option[data-ng-repeat]');
        
        if (repeatOption.length) {
          repeatAttr = repeatOption.attr('ng-repeat') || repeatOption.attr('data-ng-repeat');
          watch = jQuery.trim(repeatAttr.split('|')[0]).split(' ').pop();
        }
      }
      
      return function(scope, elm, attrs, controller) {
        // instance-specific options
        var isMultiple = attrs.hasOwnProperty('multiple') ? !!attrs.multiple : !!scope.$eval(tAttrs.multipleBinding), 
        type = attrs.maiaType || attrs.maiaClass || scope.$eval(attrs.maiaClassBinding || tAttrs.maiaTypeBinding), 
        formatter = $parse(attrs.formatter || scope.$eval(attrs.formatterBinding) || 'label'), 
        creator = $parse(attrs.creator || scope.$eval(attrs.creatorBinding) || 'text').assign, 
        creatorDialog = attrs.creatorDialog || scope.$eval(attrs.creatorDialogBinding), 
        maxItems = attrs.maxItems || scope.$eval(attrs.maxItemsBinding);
        
        var map = scope.$eval(attrs.maiaMap) || function(item) {
          return {_id: item._id,text: formatter(item) || ''}
        };
        
        var filter = scope.$eval(attrs.maiaFilter) || function(item, term) {
          if (String(item.text || '').toLowerCase().indexOf(term.toLowerCase()) === -1)
            return false;
          if (String(item.text || '').toLowerCase() === term.toLowerCase())
            return 'exact';
          return true;
        }
        
        var getItems = function() {
          if (type.indexOf(',') === -1)
            return objectValues(model[type] || {});
          var results = [];
          type.split(',').forEach(function(type) {
            results = results.concat(objectValues(model[type] || {}));
          });
          return results;
        }
        
        var query = attrs.query || scope.$eval(attrs.queryBinding) || function(options) {
          var haveExactMatch = false;
          var results = getItems()
          .map(map)
          .filter(function(item) {
            var r = filter(item, options.term);
            if (r === 'exact')
              haveExactMatch = true;
            return r;
          });
          
          if (!haveExactMatch && (options.term || creatorDialog)) {
            var onSelect = function(data, callback) {
              var item = {_class: type};
              creator(item, data.term);
              
              if (creatorDialog) {
                scope.$apply(function() {
                  openDialog($dialog, {
                    item: item,
                    callback: function(item) {
                      if (!item)
                        return;
                      callback(map(item));
                    },
                    type: type,
                    templateUrl: 'templates/' + type + '.html'
                  });
                });
              } else {
                updateObject(item, function(item) {
                  callback(map(item));
                });
              }
            }
            
            results.push({
              _id: '__new__',
              text: options.term ? "Create '" + options.term + "'..." : "Create...",
              term: options.term,
              onSelect: onSelect
            });
          }
          
          options.callback({results: results});
        }

        var opts = {};
        opts.id = '_id';
        opts.query = query;
        
        if (maxItems)
          opts.maximumSelectionSize = maxItems;
        
        if (isSelect) {
          // Use <select multiple> instead
          delete opts.multiple;
          delete opts.initSelection;
        } else if (isMultiple) {
          opts.multiple = true;
        }
        
        if (controller) {
          // Watch the model for programmatic changes
          controller.$render = function() {
            // Initialize the values on the controller.
            var val = controller.$modelValue;

            if (isSelect) {
              elm.select2('val', val);
            } else {
              if (isMultiple && !val) {
                elm.select2('data', []);
              } else if (angular.isObject(val)) {
                elm.select2('data', val);
              } else {
                elm.select2('data', {});
              }
            }
          };
          
          if (!isSelect) {
            // Set the view and model value and update the angular template manually for the ajax/multiple select2.
            elm.bind("change", function() {
              scope.$apply(function() {
                controller.$setViewValue(elm.select2('data'));
              });
            });
            
            if (opts.initSelection) {
              var initSelection = opts.initSelection;
              opts.initSelection = function(element, callback) {
                initSelection(element, function(value) {
                  controller.$setViewValue(value);
                  callback(value);
                });
              };
            }
          }
        }
        
        attrs.$observe('disabled', function(value) {
          elm.select2(value && 'disable' || 'enable');
        });

        // Set initial value since Angular doesn't
        elm.val(scope.$eval(attrs.ngModel));

        // Initialize the plugin late so that the injected DOM does not disrupt the template compiler
        //setTimeout(function () {
        elm.select2(opts);
        //});
        
        if (attrs.maxItemsBinding) {
          var binding = scope[attrs.maxItemsBinding];
          scope.$watch(binding, function(newVal) {
            elm.select2('update', {maximumSelectionSize: newVal});
          });
        }
        ;
        
        elm.bind('$destroy', function() {
          elm.select2('destroy');
        });
      };
    }
  };
});


angular.module('maia').directive('maiaGraph', function($dialog, $parse, $interpolate) {
  return {
    compile: function(tElm, tAttrs) {
      return function(scope, elm, attrs, controller) {
        
        
        var onMove = scope.$eval(attrs.onmove);
        var onLink = scope.$eval(attrs.onlink);
        var onUnlink = scope.$eval(attrs.onunlink);
        var onChangeLink = scope.$eval(attrs.onchangelink);
        var directed = !!attrs.directed;
        var labelEditable = !!attrs.labelEditable;
        var query = scope.$eval(attrs.query);
        var renderTimeout = false;
        var self = this;
        
        function delayedUpdate() {
          if (renderTimeout)
            return;
          renderTimeout = setTimeout(render, 0);
        }
        
        function render() {
          var g = new Graph();
          g.layoutMinX = 0;
          g.layoutMinY = 0;
          g.layoutMaxX = 1000;
          g.layoutMaxY = 1000;
          
          g.bind('movenode', function(args) {
            onMove(args.node.id, {x: args.x,y: args.y});
          });
          
          g.bind('createedge', function(args) {
            onLink(args.fromNode.id, args.toNode.id);
            delayedUpdate();
          });
          
          g.bind('destroyedge', function(args) {
            onUnlink(args.fromNode.id, args.toNode.id);
            delayedUpdate();
          });
          
          g.bind('changeedgelabel', function(args) {
            onLink(args.fromNode.id, args.toNode.id, args.label || '');
            delayedUpdate();
          });
          
          query(function(result) {
            var nodes = result.nodes || [], 
            links = result.links || [];
            
            for (var i = 0; i < nodes.length; i++) {
              var node = nodes[i];
              g.addNode(node.id, {
                id: node.id,
                label: node.label,
                layoutPosX: node.pos.x,
                layoutPosY: node.pos.y,
                color: node.color || "#00bf2f"
              });
            }
            
            for (var i = 0; i < links.length; i++) {
              var link = links[i];
              g.addEdge(link.from, link.to, {
                label: link.label || '',
                directed: directed,
                placeholder: labelEditable ? '...' : undefined,
                editable: labelEditable
              });
            }
            
            elm.empty();
            (new Graph.Renderer.Raphael(attrs.id, g, $(elm).width(), 550)).draw();
            
            renderTimeout = false;
          });
        }
        
        delayedUpdate();
        
        elm.bind('$destroy', function() {
          if (renderTimeout) {
            clearTimeout(renderTimeout);
            renderTimeout = false;
          }
        });
      };
    },
    whoop: 'whoop'
  };
});


function ListController($scope, $routeParams) {
  var _class = $routeParams['class'];
  $scope._class = _class;
  $scope.hash = model[_class];
  $scope.$watch('hash', function(newValue) {
    $scope.items = objectValues(newValue);
  }, true);
  $scope.itemTemplate = {_class: _class};
  $scope.recordTemplateUrl = 'templates/' + _class + '.html';
  $scope.createRecord = function() {
    $scope.$broadcast('openNewRecord');
  };
}


function AgentController($scope, $dialog) {

}



function openDialog($dialog, options) {
  function DialogController($scope, dialog) {
    $scope.item = options.item;
    $scope.type = options.type;
    $scope.formUrl = options.templateUrl;
       
    $scope.validators = [];
 
    $scope.save = function() {
      dialog.modalEl.removeClass('animated shake');
      if (!validate($scope, $scope.item)) {
        setTimeout(function() {
          dialog.modalEl.addClass('animated shake')
        }, 0);
        return;      
      }

      updateObject($scope.item, function(savedItem) {        
        dialog.close(savedItem);
      });
    };
    
    $scope.cancel = function() {
      dialog.close();
    }
  }
  
  var d = $dialog.dialog({
    backdrop: true,
    keyboard: true,
    backdropClick: false,
    templateUrl: 'templates/edit_dialog.html',
    controller: DialogController
  });
  
  d.open().then(function(item) {
    options.callback(item);
  });
}


function labelValidator(item) {
  if (!item.label)
    return "Label may not be empty."
  if (!/^\w+/.test(item.label))
    return "Label is not a valid identifier."
}

function validate($scope, item) {
  $scope.errors = [];
  
  if (!$scope.validators)
    return true;
  
  for (var i = 0; i < $scope.validators.length; i++) {
    var error = $scope.validators[i](item);
    if (error)
      $scope.errors.push(error);
  }
  
  return !$scope.errors.length;
}

function ListFormController($scope, $rootScope, $element) {
  if ($scope.item._id)
    $scope.mode = 'view';
  else
    $scope.mode = 'create';

  $scope.validators = [];
    
  $scope.open = function($event) {
    if ($scope.mode !== 'view')
      return;
    
    $rootScope.$broadcast('openRecord');

    $scope.originalItem = $scope.item;
    $scope.item = angular.copy($scope.item);
    $scope.mode = 'update';    
    
    $event.stopPropagation();
    $event.preventDefault();
    
    setTimeout(function() {
      $($element).scrollintoview();
    }, 50);
  }
  
  $scope.save = function($event) {
    $scope.hasErrors = false;
    if (!validate($scope, $scope.item)) {
      setTimeout(function() { $scope.$apply("hasErrors = true") }, 0);
      return;      
    }
      
    updateObject($scope.item, function($savedObject) {
      $scope.item = $savedObject;
    });
    $scope.mode = 'view';
    
    $event.stopPropagation();
    $event.preventDefault();
  }
  
  $scope.revert = function($event) {
    if ($scope.mode === 'view')
      return;
      
    $scope.item = $scope.originalItem;
    delete $scope.originalItem;
    $scope.errors = [];
    $scope.hasErrors = false;
    $scope.mode = 'view';
    
    $event && $event.stopPropagation();
    $event && $event.preventDefault();
  }
  
  $scope.$on('openRecord', function() {
    $scope.revert();
  });
}

function NewRecordController($scope, $rootScope, $element) {
  $scope.mode = 'view';
  
  $scope.validators = [];
  
  $scope.open = function($event) {
    if ($scope.mode === 'create')
      return $($element).scrollintoview();
      
    $rootScope.$broadcast('openRecord');

    $scope.item = angular.copy($scope.itemTemplate);
    $scope.mode = 'create';
    
    $event && $event.stopPropagation();
    $event && $event.preventDefault();
    
    setTimeout(function() {
      $($element).scrollintoview();
    }, 50);
  }
  
  $scope.save = function($event) {
    $scope.hasErrors = false;
    if (!validate($scope, $scope.item)) {
      setTimeout(function() { $scope.$apply("hasErrors = true") }, 0);
      return;      
    }
      
    updateObject($scope.item);
    delete $scope.item;
    $scope.mode = 'view';
    
    $event.stopPropagation();
    $event.preventDefault();
  }
  
  $scope.revert = function($event) {
    if ($scope.mode === 'view')
      return;
    
    delete $scope.item;
    $scope.errors = [];
    $scope.hasErrors = false;
    $scope.mode = 'view';
    
    $event && $event.stopPropagation();
    $event && $event.preventDefault();
  }
  
  $scope.$on('openNewRecord', function() {
    $scope.open();
  });
  
  $scope.$on('openRecord', function() {
    $scope.revert();
  });
}


/*
app.controller('Controller', function($scope) {
  $scope.items = items;
  $scope.bla = "two";
});



app.controller('TestController', function($scope) {

});
*/

function EntityActionRecordController($scope) {
  $scope.validators.push(labelValidator);
  
  function filter(item, term) {
    if (!item.text)
      return false;
    if (String(item.text || '').toLowerCase().indexOf(term.toLowerCase()) === -1)
      return false;
    return true;
  }
  
  $scope.queryPerformer = function(options) {
    var results;
    
    results = objectValues(model.agent || {}).concat(objectValues(model.physical_component || {})).concat(objectValues(model.role || {}));
    
    results = results.map(function(option) {
      return {_id: option._id,text: option.label};
    });
    results = results.filter(function(option) {
      return filter(option, options.term);
    });
    
    options.callback({results: results});
  }
  
  
  $scope.queryActionBody = function(options) {
    var val = $scope.item.performer;
    var performer, results;
    
    if (!val || !val._id)
      results = [];
    else if (performer = getObject(val._id, 'agent'))
      results = objectValues(performer.intrinsic_capabilities || {})
    else if (performer = getObject(val._id, 'role'))
      results = objectValues(performer.institutional_capabilities || {})
    else if (performer = getObject(val._id, 'physical_component'))
      results = objectValues(performer.behaviors || {})
    else
      results = [];

    //results = options.map(function(option) {
    //  return { _id: option._id, text: option._label };
    //});
    results = results.filter(function(option) {
      return filter(option, options.term);
    });
    
    options.callback({results: results});
  }
  
  $scope.queryDecisionMaking = function(options) {
    var val = $scope.item.performer;
    var performer, results;
    
    if (!val || !val._id)
      results = [];
    else if (performer = getObject(val._id, 'agent'))
      results = objectValues(performer.decision_making_criteria || {})
    else
      results = [];

    //results = options.map(function(option) {
    //  return { _id: option._id, text: option._label };
    //});
    results = results.filter(function(option) {
      return filter(option, options.term);
    });
    
    options.callback({results: results});
  }
}


function VariableComputationController($scope) {
  function filter(item, term) {
    if (!item.text)
      return false;
    if (String(item.text || '').toLowerCase().indexOf(term.toLowerCase()) === -1)
      return false;
    return true;
  }

  $scope.queryIndependentVariables = function(options) {
    var results;
    
    results = objectValues(model.variable || {}).concat(objectValues(model.property || {})).concat(objectValues(model.personal_value || {}));
    
    results = results.map(function(option) {
      return {_id: option._id,text: option.label};
    });
    results = results.filter(function(option) {
      return filter(option, options.term);
    });
    
    options.callback({results: results});
  }
}


function SelectFieldController($scope) {
  if ($scope.multiple)
    $scope.textDescription = ($scope.model[$scope.prop] || []).map(function(i) {
      return i.text || '';
    }).join(', ');
  else
    $scope.textDescription = ($scope.model[$scope.prop] || {}).text;
}


function randomPosition() {
  return {x: Math.random() * 1000,y: Math.random() * 1000};
}

function DependencyGraphController($scope) {
  $scope.query = function(callback) {
    var roles = model.role || {}, 
    nodes = [], 
    links = [];
    
    for (var key in roles) {
      if (roles.hasOwnProperty(key)) {
        var role = roles[key], 
        deps = role.dependencies || [];
        
        if (!role.dependency_graph_pos) {
          role = angular.copy(role);
          role.dependency_graph_pos = randomPosition();
          updateObject(role);
        }
        
        nodes.push({
          id: role._id,
          pos: role.dependency_graph_pos,
          label: role.label
        });
        
        for (var i = 0; i < deps.length; i++) {
          var dep = deps[i];
          if (!dep)
            continue;
          links.push({
            from: role._id,
            to: dep._id
          });
        }
      }
    }
    
    callback({nodes: nodes,links: links});
  }
  
  $scope.onLink = function(from, to) {
    var from = angular.copy(getObject(from, 'role'));
    if (!from)
      return;
    if (!from.dependencies)
      from.dependencies = [];
    from.dependencies.push({_id: to});
    updateObject(from);
  }
  
  $scope.onUnlink = function(from, to) {
    var from = angular.copy(getObject(from, 'role'));
    if (!from || !from.dependencies)
      return;
    for (var i = from.dependencies.length - 1; i >= 0; i--) {
      if (from.dependencies[i]._id == to)
        from.dependencies.splice(i, 1);
    }
    updateObject(from);
  }
  
  $scope.onMove = function(id, pos) {
    var obj = angular.copy(getObject(id, 'role'));
    if (!obj)
      return;
    obj.dependency_graph_pos = pos;
    updateObject(obj);
  }
}

function ConnectionGraphController($scope) {
  $scope.query = function(callback) {
    var physical_components = model.physical_component || {}, 
    nodes = [], 
    links = [];
    
    for (var key in physical_components) {
      if (physical_components.hasOwnProperty(key)) {
        var physical_component = physical_components[key], 
        conns = physical_component.connections || [];
        
        if (!physical_component.connection_graph_pos) {
          physical_component = angular.copy(physical_component);
          physical_component.connection_graph_pos = randomPosition();
          updateObject(physical_component);
        }
        
        nodes.push({
          id: physical_component._id,
          pos: physical_component.connection_graph_pos,
          label: physical_component.label
        });
        
        for (var i = 0; i < conns.length; i++) {
          var conn = conns[i];
          if (!conn)
            continue;
          links.push({
            from: physical_component._id,
            to: conn._id,
            label: conn.label
          });
        }
      }
    }
    
    callback({nodes: nodes,links: links});
  }
  
  $scope.onLink = function(from, to, label) {
    var from = angular.copy(getObject(from, 'physical_component'));
    if (!from)
      return;
    if (!from.connections)
      from.connections = [];
    from.connections.push({_id: to,label: label});
    updateObject(from);
  }
  
  $scope.onUnlink = function(from, to) {
    var from = angular.copy(getObject(from, 'physical_component'));
    if (!from || !from.connections)
      return;
    for (var i = from.connections.length - 1; i >= 0; i--) {
      if (from.connections[i]._id == to)
        from.connections.splice(i, 1);
    }
    updateObject(from);
  }
  
  $scope.onChangeLink = function(from, to, label) {
    $scope.onUnlink(from, to);
    $scope.onLink(from, to, label);
  }
  
  $scope.onMove = function(id, pos) {
    var obj = angular.copy(getObject(id, 'physical_component'));
    if (!obj)
      return;
    obj.connection_graph_pos = pos;
    updateObject(obj);
  }
}


function CompositionGraphController($scope) {
  $scope.query = function(callback) {
    var physical_components = model.physical_component || {}, 
    nodes = [], 
    links = [];
    
    for (var key in physical_components) {
      if (physical_components.hasOwnProperty(key)) {
        var physical_component = physical_components[key], 
        composition = physical_component.composition || [];
        
        if (!physical_component.composition_graph_pos) {
          physical_component = angular.copy(physical_component);
          physical_component.composition_graph_pos = randomPosition();
          updateObject(physical_component);
        }
        
        nodes.push({
          id: physical_component._id,
          pos: physical_component.composition_graph_pos,
          label: physical_component.label
        });
        
        for (var i = 0; i < composition.length; i++) {
          var item = composition[i];
          if (!item)
            continue;
          links.push({
            from: physical_component._id,
            to: item._id,
            label: item.label
          });
        }
      }
    }
    
    callback({nodes: nodes,links: links});
  }
  
  $scope.onLink = function(from, to) {
    var from = angular.copy(getObject(from, 'physical_component'));
    if (!from)
      return;
    if (!from.composition)
      from.composition = [];
    from.composition.push({_id: to});
    updateObject(from);
  }
  
  $scope.onUnlink = function(from, to) {
    var from = angular.copy(getObject(from, 'physical_component'));
    if (!from || !from.composition)
      return;
    for (var i = from.composition.length - 1; i >= 0; i--) {
      if (from.composition[i]._id == to)
        from.composition.splice(i, 1);
    }
    updateObject(from);
  }
  
  $scope.onMove = function(id, pos) {
    var obj = angular.copy(getObject(id, 'physical_component'));
    if (!obj)
      return;
    obj.composition_graph_pos = pos;
    updateObject(obj);
  }
}

function MatrixController($scope, $routeParams) {
  var _class = $routeParams['class'];
  $scope.entity_actions = objectValues(model.entity_action);
  $scope.variables = model.variable;
  $scope.items = objectValues(model[_class]);
}


function HelpController($scope, $location) {
  $scope.$watch(function() { 
    return $location.path()
  }, function(path) {
    var m = /^\/(\w+)\/(\w+)(?:[\/?]|$)/.exec(path);
    if (m) {
      $scope.helpUrl = 'help/' + m[1] + '-' + m[2] + '.html'
    } else {
      $scope.helpUrl = undefined;
    }
  })
}

function GenericRecordController($scope) {
  $scope.validators.push(labelValidator);
}    


function PlanRecordController($scope) {
  $scope.validators.push(labelValidator);
}