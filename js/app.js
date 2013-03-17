var app = angular.module('maia', ['ui', 'ui.bootstrap', 'maia']);

app.config(function($routeProvider, $locationProvider) {
  $routeProvider.when('/list/:class', {
    templateUrl: 'templates/list.html',
    controller: ListController
  });

  $routeProvider.when('/matrix/:class', {
    templateUrl: 'templates/matrix.html',
    controller: MatrixController
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
    scope: {label: '@', model: '=', prop: '@', mode: '='},
    templateUrl: 'templates/text-field.html'
  };
});

app.directive('pickField', function() {
  return {
    restrict: 'E',
    transclude: false,
    priority: 100,
    scope: {label: '@', model: '=', prop: '@', options: '@', mode: '='},
    templateUrl: 'templates/pick-field.html'
  };
});


app.directive('selectField', function() {
  return {
    restrict: 'E',
    transclude: false,
    priority: 100,
    scope: {
      label: '@',
      model: '=',
      prop: '@',
      mode: '=',
      type: '@',
      multiple: '@',
      formatter: '@',
      creator: '@',
      creatorDialog: '@',
      query: '=',
      maxItems: '@'
    },
    templateUrl: 'templates/select-field.html'
  };
});

app.service('$data', function() {
  var self = this;

  var byId = {};
  var byClass = {};

  function saveToLocalStorage() {
    var json = JSON.stringify(exportData());
    window.localStorage.setItem('data', json);
  }

  function loadFromLocalStorage() {
    try {
      var data = JSON.parse(window.localStorage.getItem('data'));
      importData(data);
    } catch (e) {
      clear();
    }
  }

  var saveTimer = null;
  function deferredSaveToLocalStorage() {
    if (saveTimer)
      clearTimeout(saveTimer);

    saveTimer = setTimeout(function() {
      saveTimer = null;
      saveToLocalStorage();
    }, 100);
  }

  function clear() {
    for (var _id in byId) {
      if (byId.hasOwnProperty(_id)) {
        delete byId[_id];
      }
    }

    for (var _class in byClass) {
      if (byClass.hasOwnProperty(_class)) {
        var index = byClass[_class];
        index.splice(0, index.length);
      }
    }
  }

  function importData(data) {
    clear();

    for (var i = 0; i < data.length; i++) {
      var obj = data[i];
      if (!obj || !obj._id || !obj._class)
        continue;
      byId[obj._id] = obj;
    }

    for (var _id in byId) {
      if (byId.hasOwnProperty(_id)) {
        var obj = byId[_id];

        var list = byClass[obj._class];
        if (!list)
          list = byClass[obj._class] = [];
        list.push(obj);
      }
    }
  }

  function exportData() {
    var objects = [];

    for (var _id in byId) {
      if (byId.hasOwnProperty(_id))
        objects.push(byId[_id]);
    }

    return objects;
  }

  function getObject(_id) {
    return byId[_id];
  }

  function getObjects(_class) {
    var list = byClass[_class];
    if (!list)
      list = byClass[_class] = [];
    return list;
  }

  function updateObject(obj, callback) {
    var tgt;

    if (obj._id && (tgt = getObject(obj._id))) {
      if (tgt !== obj) {
        for (var key in tgt)
          if (tgt.hasOwnProperty(key) &&
              !obj.hasOwnProperty(obj))
            delete tgt[key];

          for (var key in obj)
            if (obj.hasOwnProperty(key))
              tgt[key] = angular.copy(obj[key]);
      }
    } else {
      tgt = angular.copy(obj);
      tgt._id = Date.now();
      byId[tgt._id] = tgt;

      var list = byClass[tgt._class];
      if (!list)
        list = byClass[tgt._class] = [];

      list.push(obj);
    }

    deferredSaveToLocalStorage();

    obj._id = tgt._id;
    if (callback)
      callback(tgt);
  }

  function deleteObject(obj) {
    var id;

    if (obj && typeof obj === 'object')
      id = obj._id
    else if (typeof obj === 'number' || typeof obj === 'string')
      id = obj
    else
      throw new TypeError('First parameter should be an object or ' +
                          'an object id');

    obj = getObject(id);
    if (!obj)
      return;

    var index = byClass[obj._class];

    delete byId[id];
    index.splice(index.indexOf(obj), 1);

    // Delete all references to this object
    for (var id2 in byId) {
      if (!byId.hasOwnProperty(id2))
        continue;

      var obj2 = byId[id2];
      for (var key in obj2) {
        if (!obj2.hasOwnProperty(key))
          continue;

        var val = obj2[key];
        if (val instanceof Array) {
          for (var i = val.length - 1; i >= 0; i--) {
            if (val[i] instanceof Object && val[i]._ref == id)
              val.splice(i, 1);
          }
        } else if (val instanceof Object) {
         if (val._ref == id)
           delete obj2[key];
        }
      }
    }

    deferredSaveToLocalStorage();
  }

  this.importData = importData;
  this.exportData = exportData;
  this.getObject = getObject;
  this.getObjects = getObjects;
  this.updateObject = updateObject;
  this.deleteObject = deleteObject;

  loadFromLocalStorage();
});


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


app.directive('maiaSelect', function($dialog, $parse, $interpolate, $data) {
  return {
    require: '?ngModel',
    compile: function(tElm, tAttrs) {
      var repeatOption,
          repeatAttr,
          watch,
          isSelect = tElm.is('select');

      // Enable watching of the options dataset if in use
      if (tElm.is('select')) {
        repeatOption = tElm.find('option[ng-repeat], option[data-ng-repeat]');

        if (repeatOption.length) {
          repeatAttr = repeatOption.attr('ng-repeat') ||
                       repeatOption.attr('data-ng-repeat');
          watch = jQuery.trim(repeatAttr.split('|')[0]).split(' ').pop();
        }
      }

      return function(scope, elm, attrs, controller) {
        // instance-specific options
        var isMultiple = attrs.hasOwnProperty('multiple') ? !!attrs.multiple :
                !!scope.$eval(tAttrs.multipleBinding);
        var type = attrs.maiaType || attrs.maiaClass ||
                scope.$eval(attrs.maiaClassBinding || tAttrs.maiaTypeBinding);
        var formatter = $parse(attrs.formatter ||
                scope.$eval(attrs.formatterBinding) || 'label');
        var creator = $parse(attrs.creator ||
                scope.$eval(attrs.creatorBinding) || 'text').assign;
        var creatorDialog = attrs.creatorDialog ||
                scope.$eval(attrs.creatorDialogBinding);
        var maxItems = attrs.maxItems || scope.$eval(attrs.maxItemsBinding);

        var find = function(val) {
          return $data.getObject(val._ref);
        };

        var map = scope.$eval(attrs.maiaMap) || function(item) {
          return {id: item._id, text: formatter(item) || ''};
        };

        var makeRef = scope.$eval(attrs.maiaDemap) || function(val) {
          return { _ref: val.id };
        };

        var filter = scope.$eval(attrs.maiaFilter) || function(item, term) {
          var text = String(item.text || '').toLowerCase();
          term = term.toLowerCase();
          if (text.indexOf(term) === -1)
            return false;
          if (text === term)
            return 'exact';
          return true;
        };

        var getItems = function() {
          if (type.indexOf(',') === -1)
            return $data.getObjects(type);
          var results = [];
          type.split(',').forEach(function(type) {
            results = results.concat($data.getObject(type));
          });
          return results;
        };

        var query = attrs.query || scope.$eval(attrs.queryBinding) ||
                    function(options) {
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
                      openEditDialog($dialog, $data, {
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
                    $data.updateObject(item, function(item) {
                      callback(map(item));
                    });
                  }
                };

                results.push({
                  id: '__new__',
                  text: options.term ? "Create '" + options.term + "'..." :
                      'Create...',
                  term: options.term,
                  onSelect: onSelect
                });
              }

              options.callback({results: results});
            };

        var opts = {};
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
              } else if (!val) {
                elm.select2('data', {});
              } else if (isMultiple) {
                elm.select2('data', val.map(find).map(map));
              } else {
                elm.select2('data', map(find(val)));
              }
            }
          };

          if (!isSelect) {
            // Set the view and model value and update the angular template
            // manually for the ajax/multiple select2.
            elm.bind('change', function() {
              scope.$apply(function() {
                var val = elm.select2('data');
                if (isMultiple) {
                  val = (val || []).map(makeRef);
                } else {
                  if (val)
                    val = makeRef(val);
                }
                controller.$setViewValue(val);
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

        elm.select2(opts);

        if (attrs.maxItemsBinding) {
          var binding = scope[attrs.maxItemsBinding];
          scope.$watch(binding, function(newVal) {
            elm.select2('update', {maximumSelectionSize: newVal});
          });
        }

        elm.bind('$destroy', function() {
          elm.select2('destroy');
        });
      };
    }
  };
});


app.directive('maiaGraph', function($dialog, $parse, $interpolate) {
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
            onMove(args.node.id, {x: args.x, y: args.y});
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
                color: node.color || '#00bf2f'
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
            (new Graph.Renderer.Raphael(attrs.id,
                                        g,
                                        $(elm).width(),
                                        550)).draw();

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


function ListController($scope, $routeParams, $data) {
  var _class = $routeParams['class'];
  $scope._class = _class;
  $scope.items = $data.getObjects(_class);
  $scope.itemTemplate = {_class: _class};
  $scope.recordTemplateUrl = 'templates/' + _class + '.html';
  $scope.createRecord = function() {
    $scope.$broadcast('openNewRecord');
  };
}


function openEditDialog($dialog, $data, options) {
  function DialogController($scope, dialog) {
    $scope.item = options.item;
    $scope.type = options.type;
    $scope.formUrl = options.templateUrl;

    $scope.validators = [];

    $scope.save = function() {
      dialog.modalEl.removeClass('bounceInDown animated shake');
      if (!validate($scope, $scope.item)) {
        setTimeout(function() {
          dialog.modalEl.addClass('animated shake');
        }, 0);
        return;
      }

      $data.updateObject($scope.item, function(savedItem) {
        dialog.close(savedItem);
      });
    };

    $scope.cancel = function() {
      dialog.close();
    };
  }

  var d = $dialog.dialog({
    backdrop: true,
    keyboard: true,
    backdropClick: false,
    backdropFade: true,
    modalClass: 'modal bounceInDown animated',
    templateUrl: 'templates/edit_dialog.html',
    controller: DialogController
  });

  d.open().then(function(item) {
    options.callback(item);
  });
}


function openConfirmDialog($dialog, options) {
  function DialogController($scope, dialog) {
    $scope.title = options.title;
    $scope.question = options.question;

    $scope.ok = function() {
      dialog.close(true);
    };

    $scope.cancel = function() {
      dialog.close(false);
    };
  }

  var d = $dialog.dialog({
    backdrop: true,
    keyboard: true,
    backdropClick: false,
    backdropFade: true,
    modalClass: 'modal bounceInDown animated',
    templateUrl: 'templates/confirm_dialog.html',
    controller: DialogController
  });

  d.open().then(function(result) {
    options.callback(result);
  });
}


function labelValidator(item) {
  if (!item.label)
    return 'Label may not be empty.';
  if (!/^\w+/.test(item.label))
    return 'Label is not a valid identifier.';
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

function ListFormController($scope, $rootScope, $data, $element) {
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
  };

  $scope.save = function($event) {
    $scope.hasErrors = false;
    if (!validate($scope, $scope.item)) {
      setTimeout(function() { $scope.$apply('hasErrors = true') }, 0);
      return;
    }

    $data.updateObject($scope.item, function(savedObject) {
      $scope.item = savedObject;
    });
    $scope.mode = 'view';

    $event.stopPropagation();
    $event.preventDefault();
  };

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
  };

  $scope.delete = function($event) {
    if ($scope.mode === 'view')
      return;

    $data.deleteObject($scope.item);

    delete $scope.item;
    delete $scope.originalItem;
    $scope.mode = 'view';

    $event && $event.stopPropagation();
    $event && $event.preventDefault();
  }

  $scope.$on('openRecord', function() {
    $scope.revert();
  });
}

function NewRecordController($scope, $rootScope, $data, $element) {
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
  };

  $scope.save = function($event) {
    $scope.hasErrors = false;
    if (!validate($scope, $scope.item)) {
      setTimeout(function() { $scope.$apply('hasErrors = true') }, 0);
      return;
    }

    $data.updateObject($scope.item);
    delete $scope.item;
    $scope.mode = 'view';

    $event.stopPropagation();
    $event.preventDefault();
  };

  $scope.revert = function($event) {
    if ($scope.mode === 'view')
      return;

    delete $scope.item;
    $scope.errors = [];
    $scope.hasErrors = false;
    $scope.mode = 'view';

    $event && $event.stopPropagation();
    $event && $event.preventDefault();
  };

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

function EntityActionRecordController($scope, $data) {
  $scope.validators.push(labelValidator);

  function filter(item, term) {
    var text = String(item.text || '').toLowerCase();
    term = term.toLowerCase();
    if (text.indexOf(term) === -1)
      return false;
    return true;
  }

  $scope.queryPerformer = function(options) {
    var results;

    results = $data.getObjects('agent')
              .concat($data.getObjects('physical_component'))
              .concat($data.getObjects('role'));

    results = results.map(function(item) {
      return {id: item._id, text: item.label};
    }).filter(function(option) {
      return filter(option, options.term);
    });

    options.callback({results: results});
  };

  $scope.queryActionBody = function(options) {
    var val = $scope.item.performer;
    var performer, results;

    switch (val && val._ref && (performer = $data.getObject(val._ref)) &&
            performer._class) {
      case 'agent':
        results = performer.intrinsic_capabilities;
        break;
      case 'role':
        results = performer.institutional_capabilities;
        break;
      case 'physical_component':
        results = performer.behaviors;
        break;
    }

    results = (results || []).map(function(item) {
      return {id: item._ref, text: $data.getObject(item._ref).label};
    }).filter(function(option) {
      return filter(option, options.term);
    });

    options.callback({results: results});
  };

  $scope.queryDecisionMaking = function(options) {
    var val = $scope.item.performer;
    var performer, results;

    if (val && val._ref && (performer = $data.getObject(val._ref)) &&
        performer._class === 'agent')
      results = objectValues(performer.decision_making_criteria || {});

    results = (results || []).map(function(item) {
      return {id: item._ref, text: $data.getObject(item._ref).label};
    }).filter(function(option) {
      return filter(option, options.term);
    });

    options.callback({results: results});
  };
}


function VariableComputationController($scope, $data) {
  function filter(item, term) {
    var text = String(item.text || '').toLowerCase();
    term = term.toLowerCase;
    if (text.indexOf(term) === -1)
      return false;
    return true;
  }

  $scope.queryIndependentVariables = function(options) {
    var results;

    results = $data.getObjects('variable')
              .concat($data.getObjects('property'))
              .concat($data.getObjects('personal_value'));

    results = results.map(function(option) {
      return {id: option._id, text: option.label};
    });
    results = results.filter(function(option) {
      return filter(option, options.term);
    });

    options.callback({results: results});
  };
}


function SelectFieldController($scope, $data, $parse) {
  var val = $scope.model[$scope.prop];
  if (!val)
    return;

  var formatter = $parse($scope.formatter || 'label');

  if ($scope.multiple)
    $scope.textDescription = val.map(function(item) {
      return formatter($data.getObject(item._ref));
    }).join(', ');
  else
    $scope.textDescription = formatter($data.getObject(val._ref));
}


function randomPosition() {
  return {x: Math.random() * 1000, y: Math.random() * 1000};
}

function DependencyGraphController($scope, $data) {
  $scope.query = function(callback) {
    var roles = $data.getObjects('role'),
        nodes = [],
        links = [];

    for (var i = 0; i < roles.length; i++) {
      var role = roles[i],
          deps = role.dependencies || [];

      if (!role.dependency_graph_pos) {
        role = angular.copy(role);
        role.dependency_graph_pos = randomPosition();
        $data.updateObject(role);
      }

      nodes.push({
        id: role._id,
        pos: role.dependency_graph_pos,
        label: role.label
      });

      for (var j = 0; j < deps.length; j++) {
        var dep = deps[j];
        if (!dep)
          continue;
        links.push({
          from: role._id,
          to: dep._ref
        });
      }
    }

    callback({nodes: nodes, links: links});
  };

  $scope.onLink = function(from, to) {
    var from = angular.copy($data.getObject(from, 'role'));
    if (!from)
      return;
    if (!from.dependencies)
      from.dependencies = [];
    from.dependencies.push({_ref: to});
    $data.updateObject(from);
  };

  $scope.onUnlink = function(from, to) {
    var from = angular.copy($data.getObject(from, 'role'));
    if (!from || !from.dependencies)
      return;
    for (var i = from.dependencies.length - 1; i >= 0; i--) {
      if (from.dependencies[i]._ref == to)
        from.dependencies.splice(i, 1);
    }
    $data.updateObject(from);
  };

  $scope.onMove = function(id, pos) {
    var obj = angular.copy($data.getObject(id, 'role'));
    if (!obj)
      return;
    obj.dependency_graph_pos = pos;
    $data.updateObject(obj);
  };
}

function ConnectionGraphController($scope, $data) {
  $scope.query = function(callback) {
    var physical_components = $data.getObjects('physical_component');
    nodes = [],
    links = [];

    for (var i = 0; i < physical_components.length; i++) {
      var physical_component = physical_components[i],
          conns = physical_component.connections || [];

      if (!physical_component.connection_graph_pos) {
        physical_component = angular.copy(physical_component);
        physical_component.connection_graph_pos = randomPosition();
        $data.updateObject(physical_component);
      }

      nodes.push({
        id: physical_component._id,
        pos: physical_component.connection_graph_pos,
        label: physical_component.label
      });

      for (var j = 0; j < conns.length; j++) {
        var conn = conns[j];
        if (!conn)
          continue;
        links.push({
          from: physical_component._id,
          to: conn._ref,
          label: conn.label
        });
      }
    }

    callback({nodes: nodes, links: links});
  };

  $scope.onLink = function(from, to, label) {
    var from = angular.copy($data.getObject(from, 'physical_component'));
    if (!from)
      return;
    if (!from.connections)
      from.connections = [];
    from.connections.push({_ref: to, label: label});
    $data.updateObject(from);
  };

  $scope.onUnlink = function(from, to) {
    var from = angular.copy($data.getObject(from, 'physical_component'));
    if (!from || !from.connections)
      return;
    for (var i = from.connections.length - 1; i >= 0; i--) {
      if (from.connections[i]._ref == to)
        from.connections.splice(i, 1);
    }
    $data.updateObject(from);
  };

  $scope.onChangeLink = function(from, to, label) {
    $scope.onUnlink(from, to);
    $scope.onLink(from, to, label);
  };

  $scope.onMove = function(id, pos) {
    var obj = angular.copy($data.getObject(id, 'physical_component'));
    if (!obj)
      return;
    obj.connection_graph_pos = pos;
    $data.updateObject(obj);
  };
}


function CompositionGraphController($scope, $data) {
  $scope.query = function(callback) {
    var physical_components = $data.getObjects('physical_component'),
        nodes = [],
        links = [];

    for (var i = 0; i < physical_components.length; i++) {
      var physical_component = physical_components[i],
          composition = physical_component.composition || [];

      if (!physical_component.composition_graph_pos) {
        physical_component = angular.copy(physical_component);
        physical_component.composition_graph_pos = randomPosition();
        $data.updateObject(physical_component);
      }

      nodes.push({
        id: physical_component._id,
        pos: physical_component.composition_graph_pos,
        label: physical_component.label
      });

      for (var j = 0; j < composition.length; j++) {
        var item = composition[j];
        if (!item)
          continue;
        links.push({
          from: physical_component._id,
          to: item._ref,
          label: item.label
        });
      }
    }

    callback({nodes: nodes, links: links});
  };

  $scope.onLink = function(from, to) {
    var from = angular.copy($data.getObject(from, 'physical_component'));
    if (!from)
      return;
    if (!from.composition)
      from.composition = [];
    from.composition.push({_ref: to});
    $data.updateObject(from);
  };

  $scope.onUnlink = function(from, to) {
    var from = angular.copy($data.getObject(from, 'physical_component'));
    if (!from || !from.composition)
      return;
    for (var i = from.composition.length - 1; i >= 0; i--) {
      if (from.composition[i]._ref == to)
        from.composition.splice(i, 1);
    }
    $data.updateObject(from);
  };

  $scope.onMove = function(id, pos) {
    var obj = angular.copy($data.getObject(id, 'physical_component'));
    if (!obj)
      return;
    obj.composition_graph_pos = pos;
    $data.updateObject(obj);
  };
}

function MatrixController($scope, $data, $routeParams) {
  var _class = $routeParams['class'];
  $scope.entity_actions = $data.getObjects('entity_action');
  $scope.variables = $data.getObjects('variable');
  $scope.items = $data.getObjects('_class');
}


function HelpController($scope, $location) {
  $scope.$watch(function() {
    return $location.path();
  }, function(path) {
    var m = /^\/(\w+)\/(\w+)(?:[\/?]|$)/.exec(path);
    if (m) {
      $scope.helpUrl = 'help/' + m[1] + '-' + m[2] + '.html';
    } else {
      $scope.helpUrl = undefined;
    }
  });
}

function GenericRecordController($scope) {
  $scope.validators.push(labelValidator);
}


function PlanRecordController($scope) {
  $scope.validators.push(labelValidator);
}
