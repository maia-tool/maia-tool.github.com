var app = angular.module('maia', ['ui', 'ui.bootstrap', 'maia']);

app.config(function($dialogProvider) {
  $dialogProvider.options({
    backdrop: true,
    keyboard: true,
    backdropClick: false,
    backdropFade: true,
    modalClass: 'modal bounceInDown animated',
  });
});

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

app.directive('selectField', function() {
  return {
    restrict: 'E',
    transclude: true,
    priority: 100,
    scope: {label: '@', model: '=', prop: '@', mode: '=', options: '@'},
    templateUrl: 'templates/select-field.html'
  };
});

app.directive('remoteSelectField', function() {
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
    templateUrl: 'templates/remote-select-field.html'
  };
});

app.service('$data', function($drive) {
  var self = this;

  var byId = {};
  var byClass = {};
  var metadata = {};

  function saveToLocalStorage() {
    var exports = exportData();
    window.localStorage.setItem('data', JSON.stringify(exports[0]));
    window.localStorage.setItem('metadata', JSON.stringify(exports[1]));
  }

  function loadFromLocalStorage() {
    try {
      var data = JSON.parse(window.localStorage.getItem('data'));
      var metadata = JSON.parse(window.localStorage.getItem('metadata') || '{}');
      importData(data);
      setMetadata(metadata);
    } catch (e) {
      clear();
      setMetadata();
    }
  }

  function saveToDrive(callback) {
    var metadata = angular.copy(getMetadata());

    if (metadata.revision)
      metadata.savedRevision = metadata.revision;
    else
      metadata.savedRevision = metadata.revision = 1;

    metadata.savedDate = (new Date()).toISOString();

    var data = {
      objects: exportObjects(),
      metadata: angular.copy(metadata)
    };

    var json = JSON.stringify(data);

    $drive.save(metadata, json, function(err, metadata2) {
      if (err)
        return callback(err);

      updateMetadata(metadata);
      updateMetadata(metadata2);
      saveToLocalStorage();

      callback();
    });
  }

  function loadFromDrive(id, callback) {
    $drive.load(id, function(err, metadata2, json) {
      if (err)
        return callback(err);

      try {
        var data = JSON.parse(json);
      } catch (e) {
        return callback(e);
      }

      setMetadata(data.metadata);
      updateMetadata(metadata2);
      importData(data.objects);

      saveToLocalStorage();

      callback();
    });
  }

  function newModel() {
    clear();
    setMetadata({});

    saveToLocalStorage();
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

  function exportObjects() {
    var objects = [];

    for (var _id in byId) {
      if (byId.hasOwnProperty(_id))
        objects.push(byId[_id]);
    }

    return objects;
  }

  function exportData() {
    var objects = exportObjects();
    return [objects, metadata];
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

  function guid() {
    var now = Date.now();

    function x() {
      var r = (Math.random() * 0x10) ^ (now & 0xf);
      now >>>= 4;
      return r.toString(16);
    }

    function y() {
      var r = 0x08 + ((Math.random() * 0x4) ^ (now & 0x3));
      now >>>= 2;
      return r.toString(16);
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/x/g, x)
                                                 .replace(/y/, y);
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
      tgt._id = guid();
      byId[tgt._id] = tgt;

      var list = byClass[tgt._class];
      if (!list)
        list = byClass[tgt._class] = [];

      list.push(tgt);
    }

    bumpRevision();
    deferredSaveToLocalStorage();

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

    bumpRevision();
    deferredSaveToLocalStorage();
  }

  function getMetadata() {
    return metadata;
  }

  function setMetadata(metadata_) {
    for (var key in metadata) {
      if (metadata.hasOwnProperty(key))
        delete metadata[key];
    }

    updateMetadata(metadata_);
  }

  function updateMetadata(metadata_) {
    metadata_ = metadata_ || {};

    for (var key in metadata_) {
      if (metadata_.hasOwnProperty(key))
        metadata[key] = metadata_[key];
    }
  }

  function bumpRevision() {
    metadata.revision = 1 + ~~metadata.revision;
  }

  this.importData = importData;
  this.exportData = exportData;
  this.saveToDrive = saveToDrive;
  this.loadFromDrive = loadFromDrive;
  this.newModel = newModel;
  this.getObject = getObject;
  this.getObjects = getObjects;
  this.updateObject = updateObject;
  this.deleteObject = deleteObject;
  this.getMetadata = getMetadata;
  this.setMetadata = setMetadata;
  this.updateMetadata = updateMetadata;

  loadFromLocalStorage();
});

var CLIENT_ID = '484431590840.apps.googleusercontent.com';
var API_KEY = 'AIzaSyBRfOuymdVHEvjHu7Z_IPcR4UK6x3O9dCc';
var SCOPES = 'https://www.googleapis.com/auth/userinfo.profile ' +
             'https://www.googleapis.com/auth/userinfo.email '+
             'https://www.googleapis.com/auth/drive';


app.service('$drive', function($rootScope, $http) {
  // Pretty hacky but I couldn't retrieve *the* $drive instance with
  // angular.injector(), it'd return a new instance.
  if (window.$drive)
    throw new Error("Multiple instantiation of the $drive service.");
  else
    window.$drive = this;

  var self = this;

  this.authorized = false;
  this.authResult = null;

  this.authorize = authorize;
  this.save = save;
  this.load = load;

  backgroundAuthorize();

  function backgroundAuthorize() {
    if (!gapi.auth || !gapi.auth.authorize)
      return setTimeout(backgroundAuthorize, 100);

    // Check authorization without showing popup.
    gapi.auth.authorize({'client_id': CLIENT_ID,
                         'scope': SCOPES,
                         'immediate': true},
                        onAuthorize);

    function onAuthorize(result) {
      $rootScope.$apply(function() {
        self.authResult = result;
        self.authorized = result && !result.error;
      });
    }
  }

  function authorize(callback) {
    if (self.authorized) {
      if (callback)
        setTimeout(callback, 0);
      return;
    }

    gapi.auth.authorize({'client_id': CLIENT_ID,
                         'scope': SCOPES,
                         'immediate': false},
                        onAuthorize);

    function onAuthorize(result) {
      self.authResult = result;
      self.authorized = result && !result.error;

      if (!callback)
        return;
      else if (self.authorized)
        callback(null, result);
      else
        callback(result ? result.error : 'Not authorized');
    }
  }

  function load(id, callback) {
    authorize(function(err) {
      if (err)
        return callback(err);

      var config = {
        method: 'GET',
        path: '/drive/v2/files/' + id,
        callback: onMetadataLoad
      };

      gapi.client.request(config);

      function onMetadataLoad(driveMetadata, result) {
        if (!driveMetadata)
          return callback(result.status + ' ' + result.statusText);

        var config = {
          method: 'GET',
          url: driveMetadata.downloadUrl,
          headers: {
            Authorization: self.authResult.token_type + ' ' +
                           self.authResult.access_token,
            // Drop the x-requested-with header which is frivolously added
            // by angularjs...
            'X-Requested-With': null
          },
          transformResponse: []
        };

        $http(config)
            .success(function(data, status, headers, config) {
              var newMetadata = {
                id: driveMetadata.id,
                title: driveMetadata.title
              };
              callback(null, newMetadata, data);
            })
            .error(function(data, status, headers, config) {
              callback(status);
            });

      }
    });
  }

  function save(metadata, data, callback) {
    authorize(function(err) {
      if (err)
        return callback(err);

      var path = '/upload/drive/v2/files',
          method = 'POST';

      if (metadata.id) {
        path += '/' + metadata.id;
        method = 'PUT';
      }

      var boundary = '===b-o_u-n_d-a_r-y===',
          mimeType = 'application/maia+json';

      var driveMetadata = {
        title: metadata.title || 'Untitled MAIA model',
        mimeType: mimeType
      };

      var body = '--' + boundary + '\r\n' +
                 'Content-Type: application/json; charset=UTF-8\r\n' +
                 '\r\n' +
                 JSON.stringify(driveMetadata) + '\r\n' +
                 '--' + boundary + '\r\n' +
                 'Content-Type: ' + mimeType + '\r\n' +
                 '\r\n' +
                 data + '\r\n' +
                 '--' + boundary + '--';

      var config = {
        method: method,
        path: path,
        params: {
          uploadType: 'multipart',
        },
        headers: {
          'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        body: body,
        callback: onUploaded
      };

      gapi.client.request(config);

      function onUploaded(response, result) {
        if (!response)
          return callback(result.status + ' ' + result.statusText);

        var newMetadata = {
          id: response.id,
          title: response.title
        };
        callback(null, newMetadata);

        $rootScope.$digest();
      }
    });
  }
});


function objectValues(obj) {
  var arr = [];
  for (var key in obj)
    obj.hasOwnProperty(key) && arr.push(obj[key]);
  return arr;
}


app.directive('foreignSelect', function($dialog, $parse, $interpolate, $data) {
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

app.directive('select2', ['ui.config', '$http', function (uiConfig, $http) {
  var options = {};
  if (uiConfig.select2) {
    angular.extend(options, uiConfig.select2);
  }
  return {
    require: '?ngModel',
    compile: function (tElm, tAttrs) {
      var watch,
        repeatOption,
		repeatAttr,
        isSelect = tElm.is('select'),
        isMultiple = (tAttrs.multiple !== undefined);

      // Enable watching of the options dataset if in use
      if (tElm.is('select')) {
        repeatOption = tElm.find('option[ng-repeat], option[data-ng-repeat]');

        if (repeatOption.length) {
		      repeatAttr = repeatOption.attr('ng-repeat') || repeatOption.attr('data-ng-repeat');
          watch = jQuery.trim(repeatAttr.split('|')[0]).split(' ').pop();
        }
      }

      return function (scope, elm, attrs, controller) {
        // instance-specific options
        var opts = angular.extend({}, options, scope.$eval(attrs.uiSelect2));

        if (isSelect) {
          // Use <select multiple> instead
          delete opts.multiple;
          delete opts.initSelection;
        } else if (isMultiple) {
          opts.multiple = true;
        }

        if (controller) {
          // Watch the model for programmatic changes
          controller.$render = function () {
            if (isSelect) {
              elm.select2('val', controller.$modelValue);
            } else {
              if (isMultiple && !controller.$modelValue) {
                elm.select2('data', []);
              } else if (angular.isObject(controller.$modelValue)) {
                elm.select2('data', controller.$modelValue);
              } else {
                elm.select2('val', controller.$modelValue);
              }
            }
          };


          // Watch the options dataset for changes
          if (watch) {
            scope.$watch(watch, function (newVal, oldVal, scope) {
              if (!newVal) return;
              // Delayed so that the options have time to be rendered
              setTimeout(function () {
                elm.select2('val', controller.$viewValue);
                // Refresh angular to remove the superfluous option
                elm.trigger('change');
              });
            });
          }

          if (!isSelect) {
            // Set the view and model value and update the angular template manually for the ajax/multiple select2.
            elm.bind("change", function () {
              scope.$apply(function () {
                controller.$setViewValue(elm.select2('data'));
              });
            });

            if (opts.initSelection) {
              var initSelection = opts.initSelection;
              opts.initSelection = function (element, callback) {
                initSelection(element, function (value) {
                  controller.$setViewValue(value);
                  callback(value);
                });
              };
            }
          }
        }

        attrs.$observe('disabled', function (value) {
          elm.select2(value && 'disable' || 'enable');
        });

        if (attrs.ngMultiple) {
          scope.$watch(attrs.ngMultiple, function(newVal) {
            elm.select2(opts);
          });
        }

        // Set initial value since Angular doesn't
        elm.val(scope.$eval(attrs.ngModel));

        // Initialize the plugin late so that the injected DOM does not disrupt the template compiler
        elm.select2(opts);

        elm.bind('$destroy', function() {
          elm.select2('destroy');
        });
      };
    }
  };
}]);

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

          g.onmovenode = function(args) {
            onMove(args.node.id, {x: args.x, y: args.y});
          };

          g.oncreateedge = function(args) {
            onLink(args.fromNode.id, args.toNode.id);
            delayedUpdate();
          };

          g.ondestroyedge = function(args) {
            onUnlink(args.fromNode.id, args.toNode.id);
            delayedUpdate();
          };

          g.onchangeedgelabel = function(args) {
            onChangeLink(args.fromNode.id, args.toNode.id, args.label || '');
            delayedUpdate();
          };

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

function ListFormController($scope, $rootScope, $data, $dialog, $element) {
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

    openConfirmDialog($dialog, {
      title: 'Confirm delete',
      question: 'Are you sure you want to delete ' +
                $scope.originalItem._class + ' ' +
                "'" + $scope.originalItem.label + "'?",
      callback: function(result) {
        if (!result)
          return;

        $data.deleteObject($scope.item);

        delete $scope.item;
        delete $scope.originalItem;
        $scope.mode = 'view';

        $event && $event.stopPropagation();
        $event && $event.preventDefault();
      }
    });
  };

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
}


function VariableComputationController($scope, $data) {
  function filter(item, term) {
    var text = String(item.text || '').toLowerCase();
    term = term.toLowerCase();
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

function SelectFieldController($scope) {
  var optionMap = {};
  $scope.options.split(/\s*,\s*/).forEach(function(val) {
    var colon = val.indexOf(':');
    if (colon >= 0) {
      optionMap[val.slice(0, colon)] = val.slice(colon + 1)
    } else {
      optionMap[val] = val || '-';
    }
  });
  $scope.optionMap = optionMap;
}

function RemoteSelectFieldController($scope, $data, $parse) {
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


function initGraphPosition(obj, prefix, $data) {
  if ((!obj[prefix + '_x'] && obj[prefix + '_x'] !== 0) ||
      (!obj[prefix + '_y'] && obj[prefix + '_y'] !== 0)) {
    obj = angular.copy(obj);
    obj[prefix + '_x'] = Math.random() * 1000;
    obj[prefix + '_y'] = Math.random() * 1000;
    $data.updateObject(obj);
  }

  return { x: obj[prefix + '_x'], y: obj[prefix + '_y'] };
}

function DependencyGraphController($scope, $data) {
  $scope.query = function(callback) {
    var roles = $data.getObjects('role'),
        nodes = [],
        links = [];

    for (var i = 0; i < roles.length; i++) {
      var role = roles[i],
          deps = role.dependencies || [];

      nodes.push({
        id: role._id,
        pos: initGraphPosition(role, 'dependency_graph', $data),
        label: role.label
      });

      for (var j = 0; j < deps.length; j++) {
        var dep = deps[j];
        if (!dep)
          continue;
        links.push({
          from: role._id,
          to: dep._ref,
          label: dep.label
        });
      }
    }

    callback({nodes: nodes, links: links});
  };

  $scope.onLink = function(from, to, label) {
    var from = angular.copy($data.getObject(from, 'role'));
    if (!from)
      return;
    if (!from.dependencies)
      from.dependencies = [];
    from.dependencies.push({_ref: to, label: label});
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

  $scope.onChangeLink = function(from, to, label) {
    $scope.onUnlink(from, to);
    $scope.onLink(from, to, label);
  };

  $scope.onMove = function(id, pos) {
    var obj = angular.copy($data.getObject(id, 'role'));
    if (!obj)
      return;
    obj.dependency_graph_x = pos.x;
    obj.dependency_graph_y = pos.y;
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

      nodes.push({
        id: physical_component._id,
        pos: initGraphPosition(physical_component, 'connection_graph', $data),
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
    obj.connection_graph_x = pos.x
    obj.connection_graph_y = pos.y;
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

      nodes.push({
        id: physical_component._id,
        pos: initGraphPosition(physical_component, 'composition_graph', $data),
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

  $scope.onLink = function(from, to, label) {
    var from = angular.copy($data.getObject(from, 'physical_component'));
    if (!from)
      return;
    if (!from.composition)
      from.composition = [];
    from.composition.push({_ref: to, label: label});
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

  $scope.onChangeLink = function(from, to, label) {
    $scope.onUnlink(from, to);
    $scope.onLink(from, to, label);
  };

  $scope.onMove = function(id, pos) {
    var obj = angular.copy($data.getObject(id, 'physical_component'));
    if (!obj)
      return;
    obj.composition_graph_x = pos.x;
    obj.composition_graph_y = pos.y;
    $data.updateObject(obj);
  };
}

function MatrixController($scope, $data, $routeParams) {
  var _class = $routeParams['class'];

  if (_class == 'problem_domain_variable')
    $scope.matrixType = 'problem_domain';
  else if (_class == 'validation_variable')
    $scope.matrixType = 'validation';

  $scope.entity_actions = $data.getObjects('entity_action');
  $scope.items = $data.getObjects(_class);
}

function MatrixDependentVariableController($scope, $data) {
  var dependentVariableId = $scope.item &&
                            $scope.item.dependent_variable &&
                            $scope.item.dependent_variable._ref;
  $scope.dependentVariable = dependentVariableId &&
                             $data.getObject(dependentVariableId);
}

function MatrixValueController($scope, $data) {
  var matrixType = $scope.matrixType,
      item = $scope.item,
      ent = $scope.ent;

  var assoc = ent[matrixType] || [];

  for (var i = 0; i < assoc.length; i++) {
    if (assoc[i]._ref === item._id) {
      $scope.modelValue = assoc[i].value;
      break;
    }
  }

  $scope.value = $scope.modelValue;

  $scope.$watch('value', function() {
    // Prevent updating the model when rendering the view.
    if ($scope.value === $scope.modelValue)
      return;

    var obj = angular.copy(ent),
        assoc = obj[matrixType] || (obj[matrixType] = []);

    $scope.modelValue = $scope.value;

    // Try to update an existing association first
    for (var i = 0; i < assoc.length; i++) {
      if (assoc[i]._ref === item._id) {
        assoc[i].value = $scope.value;
        $data.updateObject(obj);
        break;
      }
    }

    // Add a new relation if none was updated.
    assoc.push({
      _ref: item._id,
      value: $scope.value
    });
    $data.updateObject(obj);
  });
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

app.service('$picker', function($drive) {
  var picker;

  this.getPicker = getPicker;

  function getPicker() {
    if (!picker)
      picker = buildPicker();

    return picker;
  }

  function buildPicker() {
    var view = new google.picker.DocsView(google.picker.ViewId.DOCS);
    view.setMimeTypes('application/maia+json');
    view.setMode(google.picker.DocsViewMode.LIST);

    var picker = new google.picker.PickerBuilder()
                 .setAppId(CLIENT_ID)
                 .addView(view)
                 .addView(new google.picker.View(google.picker.ViewId.FOLDERS))
                 .addView(new google.picker.DocsUploadView())
                 .setOAuthToken($drive.authResult.access_token)
                 .build();

    return picker;
  }
});

function NavbarController($scope, $data, $drive, $dialog, $picker, $rootScope) {
  $scope.drive = $drive;
  $scope.metadata = $data.getMetadata();
  $scope.saving = false;

  $scope.$watch('metadata.title', function(title) {
    if (title) {
      $scope.formattedTitle1 = "'" + title + "'";
      $scope.formattedTitle2 = title;
    } else {
      $scope.formattedTitle1 = 'This model';
      $scope.formattedTitle2 = 'Unnamed model'
    }
  });

  function confirmDiscardSave(cb) {
    if ($scope.metadata.revision == $scope.metadata.savedRevision)
      return cb();

    $dialog.dialog({
      templateUrl: 'templates/discard-save-dialog.html',
      controller: 'DiscardSaveDialogController'
    }).open()
      .then(function(result) {
        if (result === 'save')
          $scope.save(function(saved) {
            if (saved)
              cb();
          });
        else if (result === 'discard')
          cb();
      });
  }

  $scope.newModel = function() {
    confirmDiscardSave(function() {
      $data.newModel();
    });
  };

  $scope.save = function(cb) {
    // Show dialog box only if the model has never been saved before.
    if (!$scope.metadata.id) {
      $dialog.dialog({
        templateUrl: 'templates/save-rename-copy-dialog.html',
        controller: 'SaveDialogController'
      }).open()
        .then(function(saved) {
          if (cb)
            cb(saved);
        });

    } else {
      $scope.saving = true;
      $data.saveToDrive(function(err) {
        $scope.saving = false;

        if (cb)
          cb(!err);
      });
    }
  };

  $scope.rename = function() {
    $dialog.dialog({
      templateUrl: 'templates/save-rename-copy-dialog.html',
      controller: 'RenameDialogController'
    }).open();
  };

  $scope.copy = function() {
    $dialog.dialog({
      templateUrl: 'templates/save-rename-copy-dialog.html',
      controller: 'CopyDialogController'
    }).open();
  };

  $scope.open = function() {
    confirmDiscardSave(function() {
      $drive.authorize(function(err) {
        if (err)
          return;

        var picker = $picker.getPicker();
        picker.setCallback(onPick);
        picker.setVisible(true);

        function onPick(result) {
          if (!result || result.action !== 'picked' || !result.docs ||
              !result.docs[0])
            return;

          $data.loadFromDrive(result.docs[0].id, function(err) {
            if (err)
              return;

            picker.setVisible(false);
          });
        }
      });
    });
  };
}


function SaveDialogController($scope, $data, $drive, $rootScope, dialog) {
  $scope.title = $data.getMetadata().title || '';
  $scope.drive = $drive;
  $scope.busy = false;
  $scope.mode = 'save';

  $scope.save = function() {
    $scope.busy = true;
    $data.updateMetadata({title: $scope.title});

    $data.saveToDrive(function(err) {
      dialog.close(!err);
    });
  };

  $scope.close = function() {
    dialog.close(false);
  };
}


function RenameDialogController($scope, $data, $drive, $rootScope, dialog) {
  $scope.title = $data.getMetadata().title || '';
  $scope.drive = $drive;
  $scope.busy = false;
  $scope.mode = 'rename';

  $scope.save = function() {
    $scope.busy = true;
    $data.updateMetadata({title: $scope.title});

    $data.saveToDrive(function(err) {
      dialog.close(!err);
    });
  };

  $scope.close = function() {
    dialog.close(false);
  };
}


function CopyDialogController($scope, $data, $drive, $rootScope, dialog) {
  var title = $data.getMetadata().title;

  if (title)
    $scope.title = 'Copy of ' + title;
  else
    $scope.title = '';

  $scope.drive = $drive;
  $scope.busy = false;
  $scope.mode = 'copy';

  $scope.save = function() {
    $scope.busy = true;
    $data.updateMetadata({title: $scope.title, id: null, savedRevision: 0});

    $data.saveToDrive(function(err) {
      dialog.close(!err);
    });
  };

  $scope.close = function() {
    dialog.close(false);
  };
}


function DiscardSaveDialogController($scope, $data, $drive, $rootScope, dialog) {
  var title = $data.getMetadata().title;

  if (title)
    $scope.formattedTitle = "model '" + title + "'";
  else
    $scope.title = 'this model';

  $scope.save = function() {
    dialog.close('save');
  };

  $scope.discard = function() {
    dialog.close('discard');
  };

  $scope.cancel = function() {
    dialog.close('cancel');
  };
}
