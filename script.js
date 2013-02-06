var app = angular.module('maia', ['ui', 'ui.bootstrap', 'maia']);

var items = [
  { name: 'test1' },
  { name: 'test2' },
  { name: 'test3' }
]

var model = {
  agent: {
    1: { $class: 'agent', $id: 1, label: 'test1', properties: [] },
    2: { $class: 'agent', $id: 2, label: 'test2', properties: [] }
  },
  property: {
    3: { $class: 'property', $id: 3, label: 'mm', type: 'string' },
    4: { $class: 'property', $id: 4, label: 'boe', type: 'dus' }
  }, 
  personal_value: {
  
  }
};

app
 .directive('field', function(){
    return {
      restrict: 'E',
      transclude: true,
      scope: { label: '@' },
      templateUrl: 'templates/field.html'
    };
});

app.directive('textField', function() {
  return {
    restrict: 'E',
    transclude: false,
    priority: 100,
    scope: { label:'@', item:'=model' },
    templateUrl: 'templates/text-field.html'
  };
});

function updateObject(obj, callback) {
  angular.injector(['ng']).invoke(function($rootScope) {
    $rootScope.$apply(function() {
      var id = obj.$id || Date.now(), x=console.log(id),
          table = model[obj.$class] || (model[obj.$class] = {}),
          table = model[obj.$class] || (model[obj.$class] = {}),
          tgt = table[id] || (table[id] = {});
      
      if (!obj.$id)
        obj.$id = id;
      
      if (tgt === obj)
        return;
      
      for (var key in tgt)
        if (tgt.hasOwnProperty(key) && 
            !obj.hasOwnProperty(obj))
          delete tgt[key];
          
      for (var key in obj)
        if (obj.hasOwnProperty(key))
          tgt[key] = obj[key];
      
      console.log(tgt);
      
      callback && callback(tgt);
    });
  });  
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



angular.module('maia').directive('maiaSelect', function($dialog) {
  var options = {};
  return {
    require: '?ngModel',
    compile: function (tElm, tAttrs) {
      var repeatOption,
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
        
        var map = scope.$eval(attrs.maiaMap) || function(item) {
          return { $id: item.$id, text: item.label }
        };
        
        var filter = scope.$eval(attrs.maiaFilter) || function(item, term) {
          return String(item.text || '').toLowerCase().indexOf(term.toLowerCase()) !== -1;
        };
        
        var query = function(options) {
          var results = objectValues(model[attrs.maiaClass] || {})
                          .map(map)
                          .filter(function(item) {
                            return filter(item, options.term);
                          });
          
          if (options.term) {
            var onSelect = function(data, callback) {
              var item = (scope.$eval('maia-new') || function(data) {
                return {
                  $class: attrs.maiaClass,
                  label: data.term
                };
              })(data);
                
              scope.$apply(function() {
                openDialog($dialog, {
                  item: item,
                  callback: function(item) {
                    if (!item) 
                      return;

                    updateObject(item, function(item) {
                      callback(map(item));  
                    });
                  },
                  type: attrs.maiaClass,
                  templateUrl: 'templates/' + attrs.maiaClass + '.html'
                });
              });
            }
            
            results.push({
              $id: '__new__',
              text: "Create '" + options.term + "'...",
              term: options.term,
              onSelect: onSelect
            });
          }
          
          options.callback({ results: results });
        }
        
        var opts = {};
        
        opts.query = query;
        opts.id = '$id';
        
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
        setTimeout(function () {
          elm.select2(opts);
        });
      };
    }
  };
});



function AgentListController($scope) {
  $scope.items = model.agent;
}

function AgentController($scope, $dialog) {
  
}



function openDialog($dialog, options) {
  function DialogController($scope, dialog) {
    $scope.item = options.item;
    $scope.type = options.type;
    $scope.formUrl = options.templateUrl;
    $scope.close = dialog.close.bind(dialog);
  }

  var d = $dialog.dialog({
            backdrop: true,
            keyboard: true,
            backdropClick: false,
            templateUrl: 'templates/editDialog.html',
            controller: DialogController
          });
          
  d.open().then(function(item){
    options.callback(item);
  });
};




/*
app.controller('Controller', function($scope) {
  $scope.items = items;
  $scope.bla = "two";
});



app.controller('TestController', function($scope) {

});
*/
