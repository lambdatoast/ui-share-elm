(function(){var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/editor.js",function(require,module,exports,__dirname,__filename,process,global){var SourceSignal = require('./ui.state').SourceSignal
var show         = require('./ui.update').show
var history      = require('./history')
var compiler     = require('./compiler')

// SourceIO -> ()
function initSaveButton(source) {
  var lastCheckedSource = source.read()
  setInterval(function () {
    var currentSource = source.read()
    if (currentSource != lastCheckedSource) {
      show('#save')
      lastCheckedSource = currentSource
    }
  }, 700)
}

function initEditor() {
  var source = SourceSignal()

  compiler.init(source)

  initSaveButton(source)

  history.init(source)
}

module.exports = {
  init: initEditor
}

});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/ui.state.js",function(require,module,exports,__dirname,__filename,process,global){var query = require('./ui.query')

// String
function category() {
  return query('#editor input[name=category]')[0].value
}

// String
function previewAsHTML() {
  return query('#preview')[0].innerHTML
}

// String
function inputValueByName(name) {
  return query('input[name=' + name + ']')[0].value
}

// String
function version() {
  return query('#version')[0].value
}

// DOMElement
function rawTextArea() {
  return query("#sourcecode")[0]
}

// SourceIO = { read:() -> String, write:String -> () }
// SourceIO
function SourceSignal() {
  var io = CodeMirror.fromTextArea(rawTextArea(), {theme: "solarized"})
  return { 
    read: function () { return io.getValue() },
    write: function(v) { io.setValue(v) } 
  }
}

module.exports = {
  category: category,
  preview: {
    asHTML: previewAsHTML
  },
  rawTextArea: rawTextArea,
  query: query,
  version: version,
  inputValueByName: inputValueByName,
  SourceSignal: SourceSignal
}


});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/ui.query.js",function(require,module,exports,__dirname,__filename,process,global){function query(selector) {
  return document.querySelectorAll(selector)
}

module.exports = query



});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/ui.update.js",function(require,module,exports,__dirname,__filename,process,global){var query         = require('./ui.query')
var updateHistory = require('./history.update')
var Record        = require('./history.model').Record
var addWord       = require('./core').addWord
var http          = require('iris').http
var M             = require('./core').M
var EditorSignal  = require('./editor.state').EditorSignal
var Response      = require('./http.model').Response

function css(el, k, v) {
  el.style[k] = v
}

function show(selector, style) {
  css(query(selector)[0], 'display', style || 'inline-block')
}

function hide(selector, style) {
  css(query(selector)[0], 'display', style || 'none')
}

function updateLocationHref(href) {
  window.location.href = href
}

function updatePreviewWithError() {
  hide('.actions .view')
  query('#preview')[0].innerHTML = 'There was a server error, try again in a bit.'
}

function updatePreviewWithResult(fullViewURL) {
  query('#preview')[0].innerHTML = '<iframe src="' + fullViewURL + '"></iframe>'
  query('.actions .view')[0].href = fullViewURL
  show('.actions .view')
}

// UIButtons -> ()
function updateButtons(s) {
  Object.keys(s).forEach(function (btnID) {
    if (s[btnID] === true) {
      show("#" + btnID)
    } else {
      hide("#" + btnID)
    }
  })
}

// EditorState -> ()
function updateUI(s) {
  //console.log(s)
  updatePreviewWithResult(s.preview)
  updateButtons(s.ui.buttonState)
  updateHistory(s.route, Record(s.route, s.category, s.sourcecode))
}

// Take a SourceIO and a function. 
// Apply the function to the SourceIO.
// Execute any requests resulting fmor applying the function.
// Update the UI with the resulting state after handling the responses.
//
// SourceIO -> (Editor -> Editor) -> ()
function step(source, f) {
  var newState = f(EditorSignal(source))

  if (newState.requests.length > 0) {
    newState.requests.forEach(function (r) {
      http[r.method](r.url, { body: r.data }).ok(function (data) {
        updateUI(r.responseHandler(M(newState, Response(data))))
      }).failed(function () {
        updatePreviewWithError()
      })
    })
  }
}

module.exports = {
  css: css,
  show: show,
  hide: hide,
  locationHref: updateLocationHref,
  activateSpin: function (el) {
    el.className = addWord('icon-spin', el.className)
  },
  preview: {
    withError: updatePreviewWithError,
    withResult: updatePreviewWithResult
  },
  buttons: updateButtons,
  all: updateUI,
  step: step
}

});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/history.update.js",function(require,module,exports,__dirname,__filename,process,global){// String -> HistoryRecord
function updateHistory(url, r) {
  window.history.pushState(r, "", url)
}

module.exports = updateHistory


});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/history.model.js",function(require,module,exports,__dirname,__filename,process,global){// String -> String -> String -> HistoryRecord
function HistoryRecord(route, category, sourcecode) {
  // (can't just store EditorState in DOM history because an object with functions breaks it)
  return {
    route:       route,
    category:    category,
    sourcecode:  sourcecode
  }
}

module.exports = {
  Record: HistoryRecord
}

});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/core.js",function(require,module,exports,__dirname,__filename,process,global){var _              = require('underscore')

// String helpers

function hasWord(w, s) {
  var r = new RegExp('\\b' + w + '\\b')
  return r.test(s)
}

function addWord(w, s) {
  if (hasWord(s, w)) {
    return w
  }
  return s + " " + w;
}

function removeWord(w, s) {
  var r = new RegExp('\\b' + w + '\\b')
  return s.replace(r, '')
}

// Generic State Monad

// M a = (State, a)
function M(s, a) {
  return [s, a]
}
// a -> M a
M.unit = function (a) {
  return M(undefined, a)
}
// Ma -> (a -> M b) -> Mb
M.chain = function (m, k) {
  var x = m[0], a = m[1]
  var mb = k(a), y = mb[0], b = mb[1]
  return M(_.extend(x,y), b)
}
// State -> M ()
M.state = function (s) {
  return M(s, undefined)
}
// M a -> M a -> Boolean
M.eq = function (ma, mb) {
  return ma[0] === mb[0] && ma[1] === mb[1]
}

module.exports = {
  hasWord:    hasWord,
  addWord:    addWord,
  removeWord: removeWord,

  M:          M
}

});

require.define("/node_modules/underscore/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"underscore.js"}
});

require.define("/node_modules/underscore/underscore.js",function(require,module,exports,__dirname,__filename,process,global){//     Underscore.js 1.4.4
//     http://underscorejs.org
//     (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `global` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var push             = ArrayProto.push,
      slice            = ArrayProto.slice,
      concat           = ArrayProto.concat,
      toString         = ObjProto.toString,
      hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.4.4';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, l = obj.length; i < l; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      for (var key in obj) {
        if (_.has(obj, key)) {
          if (iterator.call(context, obj[key], key, obj) === breaker) return;
        }
      }
    }
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results[results.length] = iterator.call(context, value, index, list);
    });
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, iterator, context) {
    var result;
    any(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) results[results.length] = value;
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    return _.filter(obj, function(value, index, list) {
      return !iterator.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    each(obj, function(value, index, list) {
      if (result || (result = iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    return any(obj, function(value) {
      return value === target;
    });
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; });
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs, first) {
    if (_.isEmpty(attrs)) return first ? null : [];
    return _[first ? 'find' : 'filter'](obj, function(value) {
      for (var key in attrs) {
        if (attrs[key] !== value[key]) return false;
      }
      return true;
    });
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.where(obj, attrs, true);
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See: https://bugs.webkit.org/show_bug.cgi?id=80797
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return -Infinity;
    var result = {computed : -Infinity, value: -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed >= result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return Infinity;
    var result = {computed : Infinity, value: Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Shuffle an array.
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    return _.isFunction(value) ? value : function(obj){ return obj[value]; };
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, value, context) {
    var iterator = lookupIterator(value);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value : value,
        index : index,
        criteria : iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index < right.index ? -1 : 1;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(obj, value, context, behavior) {
    var result = {};
    var iterator = lookupIterator(value || _.identity);
    each(obj, function(value, index) {
      var key = iterator.call(context, value, index, obj);
      behavior(result, key, value);
    });
    return result;
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = function(obj, value, context) {
    return group(obj, value, context, function(result, key, value) {
      (_.has(result, key) ? result[key] : (result[key] = [])).push(value);
    });
  };

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = function(obj, value, context) {
    return group(obj, value, context, function(result, key) {
      if (!_.has(result, key)) result[key] = 0;
      result[key]++;
    });
  };

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = iterator == null ? _.identity : lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely convert anything iterable into a real, live array.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    return (n != null) && !guard ? slice.call(array, 0, n) : array[0];
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n != null) && !guard) {
      return slice.call(array, Math.max(array.length - n, 0));
    } else {
      return array[array.length - 1];
    }
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    each(input, function(value) {
      if (_.isArray(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Return a completely flattened version of an array.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    if (_.isFunction(isSorted)) {
      context = iterator;
      iterator = isSorted;
      isSorted = false;
    }
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(concat.apply(ArrayProto, arguments));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var args = slice.call(arguments);
    var length = _.max(_.pluck(args, 'length'));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(args, "" + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, l = list.length; i < l; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, l = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, l + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < l; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var len = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(len);

    while(idx < len) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    var args = slice.call(arguments, 2);
    return function() {
      return func.apply(context, args.concat(slice.call(arguments)));
    };
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context.
  _.partial = function(func) {
    var args = slice.call(arguments, 1);
    return function() {
      return func.apply(this, args.concat(slice.call(arguments)));
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) funcs = _.functions(obj);
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time.
  _.throttle = function(func, wait) {
    var context, args, timeout, result;
    var previous = 0;
    var later = function() {
      previous = new Date;
      timeout = null;
      result = func.apply(context, args);
    };
    return function() {
      var now = new Date;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
      } else if (!timeout) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, result;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) result = func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) result = func.apply(context, args);
      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return function() {
      var args = [func];
      push.apply(args, arguments);
      return wrapper.apply(this, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    if (times <= 0) return func();
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = nativeKeys || function(obj) {
    if (obj !== Object(obj)) throw new TypeError('Invalid object');
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys[keys.length] = key;
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var values = [];
    for (var key in obj) if (_.has(obj, key)) values.push(obj[key]);
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var pairs = [];
    for (var key in obj) if (_.has(obj, key)) pairs.push([key, obj[key]]);
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    for (var key in obj) if (_.has(obj, key)) result[obj[key]] = key;
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] == null) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the Harmony `egal` proposal: http://wiki.ecmascript.org/doku.php?id=harmony:egal.
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Objects with different constructors are not equivalent, but `Object`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                               _.isFunction(bCtor) && (bCtor instanceof bCtor))) {
        return false;
      }
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    var accum = Array(n);
    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named property is a function then invoke it;
  // otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return null;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name){
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    var render;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

}).call(this);

});

require.define("/node_modules/iris/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"./src/index.js"}
});

require.define("/node_modules/iris/src/index.js",function(require,module,exports,__dirname,__filename,process,global){/// index.js --- Entry point for the Iris package
//
// Copyright (c) 2012 Quildreen Motta
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation files
// (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software,
// and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = { http:  require('./http')
                 , jsonp: require('./jsonp') }
});

require.define("/node_modules/iris/src/http.js",function(require,module,exports,__dirname,__filename,process,global){/// http.js --- Deals with HTTP requests in the browser
//
// Copyright (c) 2012 Quildreen Motta
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation files
// (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software,
// and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/// Module iris.http

//// -- Dependencies ----------------------------------------------------------
var utils  = require('./utils')
var cassie = require('cassie')


//// -- Aliases ---------------------------------------------------------------
var keys               = Object.keys
var call               = Function.prototype.call
var to_array           = call.bind([].slice)
var class_of           = call.bind({}.toString)
var serialise          = utils.serialise
var build_query_string = utils.build_query_string
var clone              = utils.clone
var register           = cassie.register
var Promise            = cassie.Promise


//// -- Helpers ---------------------------------------------------------------

///// Function make_xhr
// Creates a new XMLHttpRequest object that can be used for the current
// engine.
//
// make-xhr :: () -> XMLHttpRequest
var make_xhr = function() {
                 return 'XMLHttpRequest' in this?
                        /* W3C? */ function() {
                                     return new XMLHttpRequest() }
                        :
                        /* IE? */  function() {
                                     return new ActiveXObject('Microsoft.XMLHTTP') }}()


///// Function object_p
// Is the given `subject' an `Object'?
//
// object? :: a -> Bool
function object_p(subject) {
  return class_of(subject) == '[object Object]' }


///// Function status_type
// Returns the firendly HTTP status name for the class of HTTP statuses
// the given `status' belongs to.
//
// status-type :: Number -> String
function status_type(status) {
  var type = status.toString().charAt(0) - 1
  return statuses[type] }


///// Function serialise_for_type
// Serialises the given data according to the specified MIME type.
//
// serialise-for-type :: String, { String -> String } -> String
function serialise_for_type(mime, data) {
  return mime == 'application/json'?  JSON.stringify(data)
  :      /* otherwise */              serialise(data) }


///// Function normalise_status
// Normalises HTTP response statuses for IE.
//
// normalise-status :: Number -> Number
function normalise_status(status) {
  return status == 1223?   204
  :      /* otherwise */   status }


// Whether the engine supports XHR2's `timeout' attribute
//
// support-timeout? :: Bool
var support_timeout_p = 'timeout' in make_xhr()

// A regular expression matching successful HTTP response codes
//
// success :: RegExp
var success = /2\d{2}/

// A regular expression matching client and server error HTTP response
// codes.
//
// error :: RegExp
var error = /[45]\d{2}/

// A list of friendly name for the classes of HTTP status codes.
//
// statuses :: [String]
var statuses = [ 'information'
               , 'success'
               , 'redirected'
               , 'client-error'
               , 'server-error' ]

// A list of friendly name for a request's lifecycle's state.
//
// state-map :: [String]
var state_map = [ 'unsent'
                , 'opened'
                , 'headers-received'
                , 'loading'
                , 'completed' ]



//// -- Public interface ------------------------------------------------------

///// Data active
// A list of all active promises for HTTP requests.
//
// active :: [PromiseP]
var active = []


///// Object PromiseP <| Promise
// A promise for an HTTP request.
//
// PromiseP :: Promise <| { "client"  -> XMLHttpRequest
//                        , "uri"     -> String
//                        , "options" -> { String -> String }}
var PromiseP = Promise.derive({

  ////// Function init
  // Initialises an instance of a PromiseP.
  //
  // init! :: @this:Object* -> this
  init:
  function _init(client, uri, options) {
    Promise.init.call(this)
    this.client  = client
    this.uri     = uri
    this.options = options

    return this }


  ////// Function fire
  // Immediately invokes all functions registered for the given `event',
  // even if the promise hasn't been resolved yet.
  //
  // Different from flushing, the invoked callbacks are not removed from
  // the event's list of callbacks. So a callback may `fire' multiple
  // times.
  //
  // fire :: @this:PromiseP, String, Any... -> this
, fire:
  function _fire(event) {
    var args, callbacks, i, len
    args      = to_array(arguments, 1)
    callbacks = this.callbacks[event] || []

    for (i = 0, len = callbacks.length; i < len; ++i)
      callbacks[i].apply(this, args)

    return this }


  ////// Function forget
  // Aborts a request and resolves the promise with a `forgotten`
  // failure.
  //
  // forget :: @this:PromiseP* -> this
, forget:
  function _forget() {
    this.client.abort()
    return this.flush('forgotten', 'failed').fail('forgotten') }


  ////// Function timeout
  // Specifies the maximum amount of time (in seconds) the promise can
  // take to be fulfilled. If it takes more time than time, the promise
  // fails with a `timeout' error.
  //
  // timeout :: @this:PromiseP*, Number -> this
, timeout: support_timeout_p?  function _timeout(delay) {
                                 this.timeout = delay * 1000
                                 return this }

         : /* otherwise */     function _timeout(delay) {
                                 this.clearTimer()
                                 this.timer = setTimeout( function() {
                                                            this.flush('timeouted', 'failed')
                                                                .fail('timeouted')
                                                            this.forget() }.bind(this)
                                                        , delay * 1000 )
                                 return this }


  ////// Function clear_timer
  // Stops the timer for the promise. If one was previously set by
  // invoking `timeout'.
  //
  // clear-timer :: @this:Promise* -> this
, clearTimer: support_timeout_p?  function _clear_timer() {
                                     this.timeout = 0
                                     return this }

             : /* otherwise */     Promise.clearTimer


// Generalised HTTP statuses
, information : register('status:information')
, success     : register('status:success')
, redirected  : register('status:redirected')
, clientError : register('status:client-error')
, serverError : register('status:server-error')


// Ready states
, unsent          : register('state:unsent')
, opened          : register('state:opened')
, headersReceived : register('state:headers-received')
, loading         : register('state:loading')
, completed       : register('state:completed')

// General failure statuses
, errored : register('errored')
})
PromiseP.clear_timer = PromiseP.clearTimer

///// Function request
// Makes an HTTP request to the given URI, and returns a `PromiseP' that
// such request will be fulfilled.
//
// Any actual work is carried over after the promise is returned from
// this method. As such, the user can freely manipulate the promise
// object synchronously before the connection with the endpoint is even
// opened.
//
// Aside from the event queues flushed after the promise has been
// fulfilled (or failed), the promise will also fire events from time to
// time, or depending on certain occurrences — as soon as they
// happen. Callbacks registered for those events may be invoked more
// than once, and may be invoked before the promise is fulfilled.
//
// request :: String, { String -> String } -> PromiseP
function request(uri, options) {
  var client, promise, method, serialise_body_p, mime
  options         = clone(options)
  options.headers = options.headers || {}
  method          = (options.method || 'GET').toUpperCase()
  uri             = build_uri(uri, options.query, options.body)

  options.headers['X-Requested-With'] = 'XMLHttpRequest'

  serialise_body_p = object_p(options.body)
  if (serialise_body_p) {
    mime = options.headers['Content-Type'] || 'application/x-www-form-urlencoded'
    options.body = serialise_for_type(mime, options.body)
    options.headers['Content-Type'] = mime }

  client  = make_xhr()
  promise = PromiseP.make(client, uri, options)

  setup_listeners()

  setTimeout(function() {
    client.open(method, uri, true, options.username, options.password)
    setup_headers(options.headers || {})
    client.send(options.body) })

  active.push(promise)

  return promise


  // Sticks a serialised query and body object at the end of an URI.
  // build-uri :: String, { String -> String }, { String -> String }? -> String
  function build_uri(uri, query, body) {
    uri = build_query_string(uri, query)
    return method == 'GET'?  build_query_string(uri, body)
    :      /* otherwise */   uri }

  // Setups the headers for the HTTP request
  // setup-headers :: { String -> String | [String] } -> Undefined
  function setup_headers(headers) {
    keys(headers).forEach(function(key) {
      client.setRequestHeader(key, headers[key]) })}

  // Generates a handler for the given type of error
  // make-error-handler :: String -> Event -> Undefined
  function make_error_handler(type) { return function(ev) {
    promise.flush(type, 'failed').fail(type, ev) }}

  // Invokes an error handler for the given type
  // raise :: String -> Undefined
  function raise(type) {
    make_error_handler(type)() }

  // Setups the event listeners for the HTTP request client
  // setup-listeners :: () -> Undefined
  function setup_listeners() {
    client.onerror            = make_error_handler('errored')
    client.onabort            = make_error_handler('forgotten')
    client.ontimeout          = make_error_handler('timeouted')
    client.onloadstart        = function(ev){ promise.fire('load:start', ev)    }
    client.onprogress         = function(ev){ promise.fire('load:progress', ev) }
    client.onloadend          = function(ev){ promise.fire('load:end', ev)      }
    client.onload             = function(ev){ promise.fire('load:success', ev)  }
    client.onreadystatechange = function(  ){
                                  var response, status, state
                                  state = client.readyState

                                  promise.fire('state:' + state_map[state])

                                  if (state == 4) {
                                    var binding_state = success.test(status)? 'ok'
                                                      : error.test(status)?   'failed'
                                                      : /* otherwise */       'any'

                                    response = client.responseText
                                    status   = normalise_status(client.status)
                                    active.splice(active.indexOf(promise), 1)
                                    promise.flush('status:' + status)
                                           .flush('status:' + status_type(status))

                                      status == 0?           raise('errored')
                                    : success.test(status)?  promise.bind(response, status)
                                    : error.test(status)?    promise.fail(response, status)
                                    : /* otherwise */        promise.done([response, status]) }}}
}


////// Function request_with_method
// Generates a specialised request function for the given method.
//
// request-with-method :: String -> String, { String -> String } -> PromiseP
function request_with_method(method) { return function(uri, options) {
  options        = clone(options)
  options.method = method.toUpperCase()
  return request(uri, options) }}


//// -- Exports ---------------------------------------------------------------
module.exports = { PromiseP: PromiseP
                 , request:  request
                 , active:   active
                 , get:      request_with_method('GET')
                 , post:     request_with_method('POST')
                 , put:      request_with_method('PUT')
                 , head:     request_with_method('HEAD')
                 , delete_:  request_with_method('DELETE')
                 , options:  request_with_method('OPTIONS')

                 , internal: { make_xhr: make_xhr }}

});

require.define("/node_modules/iris/src/utils.js",function(require,module,exports,__dirname,__filename,process,global){/// utils.js --- Utilities shared by all iris modules
//
// Copyright (c) 2012 Quildreen Motta
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation files
// (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software,
// and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/// Module iris.utils

//// -- Aliases ---------------------------------------------------------------
var keys   = Object.keys
var encode = encodeURIComponent


//// --- Utilities ------------------------------------------------------------
function serialise(data) {
  return keys(data || {}).map(encode_pair).filter(Boolean).join('&')

  function encode_pair(key) {
    return data[key] != null?  encode(key) + '=' + encode(data[key])
    :      /* otherwise */     null }}


function build_query_string(uri, parameters) {
  var query = serialise(parameters || {})
  var sep   = /\?/.test(uri)?  '&' : '?'
  return query?           uri + sep + query
  :      /* otherwise */  uri }


function primitive_p(x) {
  return Object(x) !== Object(x) }


// Naivë clone, no recursive checks
function clone(source) {
  source = source || {}
  return keys(source).reduce(function(result, key) {
    primitive_p(source[key])?  result[key] = source[key]
    : /* otherwise */          result[key] = clone(source[key])
    return result
  }, {})
}


//// -- Exports ---------------------------------------------------------------
module.exports = { serialise:          serialise
                 , clone:              clone
                 , build_query_string: build_query_string
                 , buildQueryString:   build_query_string
                 }
});

require.define("/node_modules/iris/node_modules/cassie/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"./src/cassie.js"}
});

require.define("/node_modules/iris/node_modules/cassie/src/cassie.js",function(require,module,exports,__dirname,__filename,process,global){/// cassie.js --- Simple future library for JS. Ready to be raped by Ajax!
//
// // Copyright (c) 2011 Quildreen Motta
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation files
// (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software,
// and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/// Module cassie


//// -- Dependencies --------------------------------------------------------
var boo = require('boo')



//// -- Aliases -------------------------------------------------------------
var derived_p = Object.isPrototypeOf
var slice     = [].slice
var Base      = boo.Base
var derive    = boo.derive



//// -- Helpers -------------------------------------------------------------

///// Function get_queue
// Returns a list of callbacks registered for the event.
//
// If callbacks ain't defined for the event yet, it's also *initialised*
// to an empty array.
//
// get_queue! :: Promise*, String -> [Fun]
function get_queue(promise, event) {
  return promise.callbacks[event]
  ||    (promise.callbacks[event] = []) }


///// Function register
// Creates a function that registers handlers for the given event.
//
// register! :: String -> @this:Promise*, Fun -> this
function register(event) { return function(fun) {
  return this.on(event, fun) }}


///// Function resolved_p
// Checks if a given promise is resolved.
//
// resolved? :: Promise -> Bool
function resolved_p(promise) {
  return !!promise.value
  &&     ( !promise.dependencies.length
        ||  promise.binding_state == 'failed' )}


///// Function remove
// Removes an item from an array
//
// remove! :: list:[a]*, a -> list
function remove(xs, x) {
  var pos = xs.indexOf(x)
  if (pos != -1)  xs.splice(pos, 1)
  return xs }


///// Function as_value
// Returns the value of a promise.
//
// as-value :: Promise -> a
function as_value(promise) {
  return promise.value }


///// Function uncurried
// Returns a special value, that lets promise transformations pass
// transformation results as variadic arguments.
//
// uncurried :: a -> Uncurried a
function uncurried(a) {
  return derive(uncurried, { value: a })}


///// Function uncurried_p
// Checks if an object is an uncurried form of a value.
//
// uncurried_p :: a -> Bool
function uncurried_p(a) {
  return derived_p.call(uncurried, a) }



//// -- Public interface ----------------------------------------------------

///// Object Promise <| Base
// A placeholder for a value that can be computed asynchronously.
//
// The `Promise' allows any code to define how they'll handle the value
// before the value is actually computed, by adding listeners to the
// various events that can be triggered once a promise is fulfilled.
//
// Promise :: { "callbacks"     -> { String -> [Fun] }
//            , "flush_queue"   -> [Fun]
//            , "value"         -> [Any]
//            , "timer"         -> TimerID
//            , "default_event" -> String
//            }
var Promise = Base.derive({
  ///// Function init
  // Initialises an instance of a Promise.
  //
  // init! :: @this:Object* -> this
  init:
  function _init() {
    this.callbacks     = {}
    this.flush_queue   = { ok: [], failed: [], any: [] }
    this.dependencies  = []
    this.value         = null
    this.timer         = null
    this.binding_state = ''
    return this }


  ///// Function on
  // Adds a callback to the given event.
  //
  // on! :: @this:Promise*, String, Fun -> this
, on:
  function _on(event, callback) {
    if (this.value)  invoke_callback(this)
    else             add_callback(this)

    return this

    // Invokes all the callbacks for the event
    function invoke_callback(promise) {
      var queue = get_queue(promise, event)
      return callback && queue.flushed?  callback.apply(promise, promise.value)
      :      /* otherwise */             null }

    // Adds the callback to the event
    function add_callback(promise) {
      return callback?  get_queue(promise, event).push(callback)
      :                 null }}


  ///// Function then
  // Creates a new promise that transforms the bound value of the
  // original promise by the given functor.
  //
  // The new promise has its own callback mappings but share the flush
  // queue with the original promise. That is, calling `flush' in the
  // new promise will flush the event queue in the original promise.
  //
  // then! :: @this:Promise*, Fun -> Promise
, then:
  function _then(callback) {
    var origin  = this
    var promise = this.make()
    promise.flush_queue = origin.flush_queue

    this.ok(    function(){ call(promise, 'bind', transform(arguments)) })
        .failed(function(){ call(promise, 'fail', transform(arguments)) })

    return promise

    function call(subject, method, arguments) {
      uncurried_p(arguments)?  subject[method].apply(subject, arguments.value)
      : /* otherwise */        subject[method](arguments) }

    function transform(xs) {
      return callback.apply(promise, xs) }}


  ///// Function wait
  // Assigns one or more promises as dependencies of this one, such that
  // this promise will only be resolved after all its dependencies are.
  //
  // wait! :: @this:Promise*, Promise... -> this
, wait:
  function _wait() {
    var self = this
    slice.call(arguments).forEach(make_dependency.bind(this))
    return this

    function make_dependency(promise) {
      this.dependencies.push(promise)
      promise.ok(remove_dependency)
      promise.failed(reject) }

    function remove_dependency() {
      remove(self.dependencies, this)
      self.flush(self.binding_state) }

    function reject() {
      self.value         = null
      self.binding_state = 'failed'

      self.flush('dependency-failed', 'failed')
          .fail.apply(self, this.value) }}


  ///// Function flush
  // Fires all the callbacks for the event.
  //
  // If the promise hasn't been resolved yet, the callbacks are placed
  // in a queue to be flushed once the Promise is fulfilled.
  //
  // flush :: @this:Promise*, String -> this
, flush:
  function _flush(event, state) {
    var self = this
    state    = state || 'any'

      !resolved_p(this)?  queue_event(event, state)
    : event?              flush_queue(event, state)
    : /* otherwise */     flush_all(state)

    return this


    // Adds the event to the flush queue
    function queue_event(event, state) {
      if (event) self.flush_queue[state].push(event) }

    // Calls all of the callbacks related to a given event
    function flush_queue(event) {
      var callbacks = get_queue(self, event)

      callbacks.forEach(function(callback) {
                          callback.apply(self, self.value) })
      callbacks.length  = 0
      callbacks.flushed = true }

    // Calls the callbacks for all events that have been queued
    function flush_all(state) {
      self.flush_queue[state].forEach(flush_queue)
      self.flush_queue['any'].forEach(flush_queue) }}


  ///// Function done
  // Fulfills the promise with the values given.
  //
  // done :: @this:Promise*, [Any] -> this
, done:
  function _done(values) {
    if (!this.value) {
      this.clear_timer()
      this.flush('done')
      this.value = slice.call(values)
      this.flush(null, this.binding_state) }

    return this }


  ///// Function fail
  // Fails to fulfill the promise.
  //
  // fail :: @this:Promise*, Any... -> this
, fail:
  function _fail() {
    this.binding_state = 'failed'
    return this.flush('failed', 'failed').done(arguments) }


  ///// Function bind
  // Successfully fulfills the promise.
  //
  // bind :: @this:Promise*, Any... -> this
, bind:
  function _bind() {
    this.binding_state = 'ok'
    return this.flush('ok', 'ok').done(arguments) }


  ///// Function forget
  // Cancels the promise.
  //
  // forget :: @this:Promise* -> this
, forget:
  function _forget() {
    return this.flush('forgotten', 'failed').fail('forgotten') }


  ///// Function timeout
  // Schedules the promise to fail after a given number of seconds.
  //
  // timeout :: @this:Promise*, Number -> this
, timeout:
  function _timeout(delay) {
    this.clear_timer()
    this.timer = setTimeout( function(){ this.flush('timeouted', 'failed')
                                             .fail('timeouted')  }.bind(this)
                           , delay * 1000)

    return this }


  ///// Function clear_timer
  // Stop the timer for the promise, if one was previously set by
  // invoking `timeout'.
  //
  // clear_timer :: @this:Promise* -> this
, clearTimer:
  function _clear_timer() {
    clearTimeout(this.timer)
    this.timer = null
    return this }


  ///// Function ok
  // Registers a callback for when the promise is successfully
  // fulfilled.
  //
  // ok :: @this:Promise*, Fun -> this
, ok: register('ok')

  ///// Function failed
  // Registers a callback for when the promise fails to be fulfilled.
  //
  // failed :: @this:Promise*, Fun -> this
, failed: register('failed')

  ///// Function timeouted
  // Registers a callback for when the promise fails by timing out.
  //
  // timeouted :: @this:Promise*, Fun -> this
, timeouted: register('timeouted')

  ///// Function forgotten
  // Registers a callback for when the promise fails by being
  // cancelled.
  //
  // forgotten :: @this:Promise*, Fun -> this
, forgotten: register('forgotten')
})
Promise.clear_timer = Promise.clearTimer


///// Function merge
// Combines several promises into one.
//
// merge :: Promise... -> Promise
function merge() {
  var dependencies = slice.call(arguments)
  var promise      = Promise.make()
  var error        = null

  promise.wait.apply(promise, arguments)
         .on('dependency-failed', function(){ error = arguments })

  dependencies.forEach(function(dep) {
                         dep.ok(promise.bind.bind(promise)) })


  return promise.then(function() {
                        return error?           uncurried(error)
                        :      /* otherwise */  uncurried(dependencies.map(as_value)) })}



//// -- Exports ---------------------------------------------------------------
module.exports = { Promise    : Promise
                 , register   : register
                 , merge      : merge
                 , uncurried  : uncurried
                 , resolved_p : resolved_p
                 , resolvedP  : resolved_p
                 , as_value   : as_value
                 , asValue    : as_value

                 , internals : { get_queue: get_queue }}

});

require.define("/node_modules/iris/node_modules/boo/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"./lib/boo.js"}
});

require.define("/node_modules/iris/node_modules/boo/lib/boo.js",function(require,module,exports,__dirname,__filename,process,global){/// boo.js --- Base primitives for prototypical OO
//
// Copyright (c) 2011 Quildreen "Sorella" Motta <quildreen@gmail.com>
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation files
// (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software,
// and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/// Module boo
void function(root, exports) {

  //// -- Aliases -------------------------------------------------------------
  var slice        = [].slice
  var keys         = Object.keys
  var inherit      = Object.create
  var define       = Object.defineProperty
  var descriptor   = Object.getOwnPropertyDescriptor
  var has_getter_p = function () {
                       try {
                         return true === Object.create( {}
                                                      , { x: { get:
                                                               function(){
                                                                 return true }}}).x }
                       catch(e){ return false }}()


  
  //// -- Interfaces ----------------------------------------------------------

  ///// Interface DataObject
  // DataObject :: { "to_data" -> () -> Object }

  ///// Interface Mixin
  // Mixin :: Object | DataObject

  
  //// -- Helpers -------------------------------------------------------------

  ///// Function copy_property
  // :internal:
  // Copies a property from ``source`' to ``target`'.
  //
  // copy_property! :: Object, target:Object*, String -> target
  function copy_property(source, target, property) {
    !has_getter_p?     target[property] = source[property]
    : /* otherwise */  define(target, property, descriptor(source, property))

    return target
  }

  ///// Function data_obj_p
  // :internal:
  // Checks if the given subject matches the ``DataObject`` interface
  //
  // data_obj_p :: Any -> Bool
  function data_obj_p(subject) {
    return subject != null
    &&     typeof subject.to_data == 'function' }


  ///// Function resolve_mixins
  // :internal:
  // Returns the proper object for the given mixin.
  //
  // resolve_mixin :: Mixin -> Object
  function resolve_mixin(subject) {
    return data_obj_p(subject)?  subject.to_data()
    :      /* otherwise */       subject }


  ///// Function fast_extend
  // :internal:
  // Extends the target object with the provided mixins, using a
  // right-most precedence rule — when a there's a property conflict, the
  // property defined in the last object wins.
  //
  // ``DataObject``s are properly handled by the ``resolve_mixin``
  // function.
  //
  // :warning: low-level
  //    This function is not meant to be called directly from end-user
  //    code, use the ``extend`` function instead.
  //
  // fast_extend! :: target:Object*, [Mixin] -> target
  function fast_extend(object, mixins) {
    var i, j, len, mixin, props, key
    for (i = 0, len = mixins.length; i < len; ++i) {
      mixin = resolve_mixin(mixins[i])
      props = keys(mixin)
      for (j = props.length; j--;) {
        key         = props[j]
        copy_property(mixin, object, key) }}

    return object }


  
  //// -- Basic primitives ----------------------------------------------------

  ///// Function extend
  // Extends the target object with the provided mixins, using a
  // right-most precedence rule.
  //
  // :see-also:
  //   - ``fast_extend`` — lower level function.
  //   - ``merge``       — pure version.
  //
  // extend! :: target:Object*, Mixin... -> target
  function extend(target) {
    return fast_extend(target, slice.call(arguments, 1)) }


  ///// Function merge
  // Creates a new object that merges the provided mixins, using a
  // right-most precedence rule.
  //
  // :see-also:
  //   - ``extend`` — impure version.
  //
  // merge :: Mixin... -> Object
  function merge() {
    return fast_extend({}, arguments) }


  ///// Function derive
  // Creates a new object inheriting from the given prototype and extends
  // the new instance with the provided mixins.
  //
  // derive :: proto:Object, Mixin... -> Object <| proto
  function derive(proto) {
    return fast_extend(inherit(proto), slice.call(arguments, 1)) }


  ///// Function make
  // Constructs a new instance of the given object.
  //
  // If the object provides an ``init`` function, that function is
  // invoked to do initialisation on the new instance.
  //
  // make :: proto:Object, Any... -> Object <| proto
  function make(base) {
    return Base.make.apply(base, slice.call(arguments, 1)) }


  
  //// -- Root object ---------------------------------------------------------

  ///// Object Base
  // The root object for basing all the OOP code. Provides the previous
  // primitive combinators in an easy and OOP-way.
  var Base = {

    ////// Function make
    // Constructs new instances of the object the function is being
    // applied to.
    //
    // If the object provides an ``init`` function, that function is
    // invoked to do initialisation on the new instance.
    //
    // make :: @this:Object, Any... -> Object <| this
    make:
    function _make() {
      var result = inherit(this)
      if (typeof result.init == 'function')
        result.init.apply(result, arguments)

      return result }

    ////// Function derive
    // Constructs a new object that inherits from the object this function
    // is being applied to, and extends it with the provided mixins.
    //
    // derive :: @this:Object, Mixin... -> Object <| this
  , derive:
    function _derive() {
      return fast_extend(inherit(this), arguments) }}


  
  //// -- Exports -------------------------------------------------------------
  exports.extend   = extend
  exports.merge    = merge
  exports.derive   = derive
  exports.make     = make
  exports.Base     = Base
  exports.internal = { data_obj_p    : data_obj_p
                     , fast_extend   : fast_extend
                     , resolve_mixin : resolve_mixin
                     , copy_property : copy_property
                     }

}
( this
, typeof exports == 'undefined'?  this.boo = this.boo || {}
  /* otherwise, yay modules! */:  exports
)

});

require.define("/node_modules/iris/src/jsonp.js",function(require,module,exports,__dirname,__filename,process,global){/// jsonp.js --- Abstracts over JSONP requests
//
// Copyright (c) 2012 Quildreen Motta
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation files
// (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software,
// and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/// Module iris.jsonp

//// -- Dependencies ----------------------------------------------------------
var utils  = require('./utils')
var cassie = require('cassie')


//// -- Aliases ---------------------------------------------------------------
var keys               = Object.keys
var call               = Function.call
var to_array           = call.bind([].slice)
var build_query_string = utils.build_query_string
var clone              = utils.clone
var Promise            = cassie.Promise


//// -- Helpers ---------------------------------------------------------------
window.__iris_callbacks__ = { }
var id_poll = []
var request_id = 0

var head = document.getElementsByTagName('head')[0]

function get_callback() {
  return id_poll.length?  'f' + id_poll.pop()
  :      /* otherwise */  'f' + ++request_id }

function noop() { }

//// -- Public interface ------------------------------------------------------
var active = []

var PromiseP = Promise.derive({
  init:
  function _init(uri, callback, options) {
    Promise.init.call(this)
    this.uri      = uri
    this.options  = options
    this.callback = callback

    return this }
})

function request(uri, options) {
  options       = clone(options)
  options.query = options.query || {}

  var callback_field = options.query.callback || 'callback'
  var callback       = get_callback()
  var script         = document.createElement('script')
  var promise        = PromiseP.make(uri, callback, options)

  active.push(promise)

  __iris_callbacks__[callback] = promise.bind.bind(promise)
  script.onerror               = promise.fail.bind(promise)

  promise.on('done', clean)

  options.query[callback_field] = '__iris_callbacks__.' + callback
  script.src                    = build_query_string(uri, options.query)
  script.async                  = true

  setTimeout(function() {  head.appendChild(script) })

  return promise

  function clean() {
    active.splice(active.indexOf(promise), 1)
    id_poll.push(callback.slice(1))
    __iris_callbacks__[callback] = noop
    script.parentNode.removeChild(script) }}


//// -- Exports ---------------------------------------------------------------
module.exports = { PromiseP: PromiseP
                 , request:  request
                 , active:   active }
});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/editor.state.js",function(require,module,exports,__dirname,__filename,process,global){var state  = require('./ui.state')
var Editor = require('./editor.model').Editor

// SourceIO
function EditorSignal(source) {
  return Editor(
    document.location.pathname,
    state.category(),
    source.read(), 
    [],
    "",
    undefined,
    state.version()
  )
}

module.exports = {
  EditorSignal: EditorSignal
}


});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/editor.model.js",function(require,module,exports,__dirname,__filename,process,global){var _         = require('underscore')
var path      = require('./path.model')
var UIButtons = require('./ui.model').UIButtons

function Editor(route, category, sourcecode, requests, preview, uiState, version) {
  return { 
    route:      route,
    category:   category,
    sourcecode: sourcecode,
    requests:   requests,
    preview:    preview,
    ui:         uiState || { buttonState: UIButtons(true, true, true) },
    version:    version
  }
}

// M[Editor,Response] -> Editor
function EditorFromStoreResponse(mr) {
  var s = mr[0], id = mr[1]
  return _.extend(s, { 
    route:   path.editor(id),
    preview: path.fullView(id, s.version),
    ui:      _.extend(s.ui, { buttonState: _.extend(s.ui.buttonState, { save: (s.category == "saved" ? false : true) }) })
  })
}

module.exports = {
  Editor:                  Editor,
  EditorFromStoreResponse: EditorFromStoreResponse
}

});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/path.model.js",function(require,module,exports,__dirname,__filename,process,global){// String -> String
function editorPath(id) {
  return '/sprout/' + id
}

// String -> String
function fullviewPath(id, version) {
  return editorPath(id) + '/' + version + '/view'
}

module.exports = {
  editor: editorPath,
  fullView: fullviewPath
}

});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/ui.model.js",function(require,module,exports,__dirname,__filename,process,global){// UIElement = { selector:String }

// String -> UIElement
function UIElement(selector) {
  return { selector: selector }
}

// { compile:DisplayState, save:DisplayState, view:DisplayState }
function UIButtons(compile, save, view) {
  return {
    compile: compile,
    save:    save,
    view:    view
  }
}
UIButtons.Show = "show"
UIButtons.Hide = "hide"

module.exports = {
  UIElement: UIElement,
  UIButtons: UIButtons
}

});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/http.model.js",function(require,module,exports,__dirname,__filename,process,global){// ResponseHandler = (M[A,Response] -> B)
// Request = { method:String, url:String, data:{}, responseHandler:ResponseHandler }
// String -> String -> {} -> ResponseHandler -> Request
function Request(method, url, data, responseHandler) {
  return { method: method, url: url, data: data, responseHandler: responseHandler || (function () { }) }
}
Request.POST = "post"
Request.GET = "get"

// {} -> Response
function Response(data) {
  return data
}

// StoreRequest = { category:String, sourcecode:String }
// String -> String -> StoreRequest
function StoreRequest(category, sourcecode ) {
  return {
    category: category,
    sourcecode: sourcecode
  }
}

module.exports = {
  Response: Response,
  Request: Request,
  StoreRequest: StoreRequest
}

});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/history.js",function(require,module,exports,__dirname,__filename,process,global){var curry  = require('curry')
var update = require('./ui.update')
var path   = require('./path.model')

// SourceIO -> PopStateEvent -> ()
var handleHistoryPopState = curry(function (source, e) {
  if (!e.state) {
    // There's always an initial `popstate` event which comes with null data, during page load, at least on Chrome.
    return
  }
  var id = e.state.route.split("/").filter(function (e) { return e != "" })[1]
  update.preview.withResult(path.fullView(id, "stable"))
  source.write(e.state.sourcecode)
})

// SourceIO -> ()
function initHistory(source) {
  window.onpopstate = handleHistoryPopState(source)
}

module.exports = {
  init: initHistory
}

});

require.define("/node_modules/curry/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"./curry"}
});

require.define("/node_modules/curry/curry.js",function(require,module,exports,__dirname,__filename,process,global){var slice = Array.prototype.slice;
var toArray = function(a){ return slice.call(a) }

// fn, [value] -> fn
//-- create a curried function, incorporating any number of
//-- pre-existing arguments (e.g. if you're further currying a function).
var createFn = function(fn, args){
    var arity = fn.length - args.length;

    if ( arity === 0 )  return function (){ return processInvocation(fn, argify(args, arguments)) };
    if ( arity === 1 )  return function (a){ return processInvocation(fn, argify(args, arguments)) };
    if ( arity === 2 )  return function (a,b){ return processInvocation(fn, argify(args, arguments)) };
    if ( arity === 3 )  return function (a,b,c){ return processInvocation(fn, argify(args, arguments)) };
    if ( arity === 4 )  return function (a,b,c,d){ return processInvocation(fn, argify(args, arguments)) };
    if ( arity === 5 )  return function (a,b,c,d,e){ return processInvocation(fn, argify(args, arguments)) };
    if ( arity === 6 )  return function (a,b,c,d,e,f){ return processInvocation(fn, argify(args, arguments)) };
    if ( arity === 7 )  return function (a,b,c,d,e,f,g){ return processInvocation(fn, argify(args, arguments)) };
    if ( arity === 8 )  return function (a,b,c,d,e,f,g,h){ return processInvocation(fn, argify(args, arguments)) };
    if ( arity === 9 )  return function (a,b,c,d,e,f,g,h,i){ return processInvocation(fn, argify(args, arguments)) };
    if ( arity === 10 ) return function (a,b,c,d,e,f,g,h,i,j){ return processInvocation(fn, argify(args, arguments)) };
    return createEvalFn(fn, args, arity);
}

// [value], arguments -> [value]
//-- concat new arguments onto old arguments array
var argify = function(args1, args2){
    return args1.concat(toArray(args2));
}

// fn, [value], int -> fn
//-- create a function of the correct arity by the use of eval,
//-- so that curry can handle functions of any arity
var createEvalFn = function(fn, args, arity){
    var argList = makeArgList(arity);

    //-- hack for IE's faulty eval parsing -- http://stackoverflow.com/a/6807726
    var fnStr = 'false||' +
                'function curriedFn(' + argList + '){ return processInvocation(fn, argify(args, arguments)); }';
    return eval(fnStr);
}

var makeArgList = function(len){
    var a = [];
    for ( var i = 0; i < len; i += 1 ) a.push('a' + i.toString());
    return a.join(',');
}

// fn, [value] -> value
//-- handle a function being invoked.
//-- if the arg list is long enough, the function will be called
//-- otherwise, a new curried version is created.
var processInvocation = function(fn, args){
    if ( args.length > fn.length ) return fn.apply(null, args.slice(0, fn.length));
    if ( args.length === fn.length ) return fn.apply(null, args);
    return createFn(fn, args);
}

// fn -> fn
//-- curries a function! <3
var curry = function(fn){
    return createFn(fn, []);
};

module.exports = curry;

});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/compiler.js",function(require,module,exports,__dirname,__filename,process,global){var UIElement      = require('./ui.model').UIElement
var clickListener  = require('./ui.event').clickListener
var changeListener = require('./ui.event').changeListener
var step           = require('./ui.update').step
var model          = require('./compiler.model')
var compile        = model.compile
var compileAs      = model.compileAs
var sourceIsEmpty  = model.sourceIsEmpty

// SourceIO -> ()
function initCompiler(source) {
  void [ 
    clickListener(UIElement("#compile"), compile),
    clickListener(UIElement("#save"), compileAs("saved")),
    changeListener(UIElement("#version"), compile)
  ].forEach(function (activateListener) {
    activateListener(source, step)
  })

  if (!sourceIsEmpty(source.read())) {
    step(source, compile)
  }
}

module.exports = {
  init: initCompiler
}

});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/ui.event.js",function(require,module,exports,__dirname,__filename,process,global){var bean  = require('bean')
var curry = require('curry')

var on = curry(function (eventType, selector, handler) {
  bean.on(document, eventType, selector, function (e) {
    e.preventDefault()
    handler()
  });
})

// EventProcessor = Signal[A] -> (EditorState -> EditorState) -> ()
// String -> UIElement -> (EditorState -> EditorState) -> (Stream[A] -> EventProcessor -> ())
var listener = curry(function (eventType, UIElement, f) {
  return function (signal, eventProcessor) {
    on(eventType, UIElement.selector, function (e) { 
      eventProcessor(signal, f)
    })
  }
})

var clickListener = listener("click")

var changeListener = listener("change")

module.exports = {
  on: on,
  listener: listener,
  clickListener: clickListener,
  changeListener: changeListener
}

});

require.define("/node_modules/bean/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"./bean.js"}
});

require.define("/node_modules/bean/bean.js",function(require,module,exports,__dirname,__filename,process,global){/*!
  * Bean - copyright (c) Jacob Thornton 2011-2012
  * https://github.com/fat/bean
  * MIT license
  */
(function (name, context, definition) {
  if (typeof module != 'undefined' && module.exports) module.exports = definition()
  else if (typeof define == 'function' && define.amd) define(definition)
  else context[name] = definition()
})('bean', this, function (name, context) {
  name    = name    || 'bean'
  context = context || this

  var win            = window
    , old            = context[name]
    , namespaceRegex = /[^\.]*(?=\..*)\.|.*/
    , nameRegex      = /\..*/
    , addEvent       = 'addEventListener'
    , removeEvent    = 'removeEventListener'
    , doc            = document || {}
    , root           = doc.documentElement || {}
    , W3C_MODEL      = root[addEvent]
    , eventSupport   = W3C_MODEL ? addEvent : 'attachEvent'
    , ONE            = {} // singleton for quick matching making add() do one()

    , slice          = Array.prototype.slice
    , str2arr        = function (s, d) { return s.split(d || ' ') }
    , isString       = function (o) { return typeof o == 'string' }
    , isFunction     = function (o) { return typeof o == 'function' }

      // events that we consider to be 'native', anything not in this list will
      // be treated as a custom event
    , standardNativeEvents =
        'click dblclick mouseup mousedown contextmenu '                  + // mouse buttons
        'mousewheel mousemultiwheel DOMMouseScroll '                     + // mouse wheel
        'mouseover mouseout mousemove selectstart selectend '            + // mouse movement
        'keydown keypress keyup '                                        + // keyboard
        'orientationchange '                                             + // mobile
        'focus blur change reset select submit '                         + // form elements
        'load unload beforeunload resize move DOMContentLoaded '         + // window
        'readystatechange message '                                      + // window
        'error abort scroll '                                              // misc
      // element.fireEvent('onXYZ'... is not forgiving if we try to fire an event
      // that doesn't actually exist, so make sure we only do these on newer browsers
    , w3cNativeEvents =
        'show '                                                          + // mouse buttons
        'input invalid '                                                 + // form elements
        'touchstart touchmove touchend touchcancel '                     + // touch
        'gesturestart gesturechange gestureend '                         + // gesture
        'textinput'                                                      + // TextEvent
        'readystatechange pageshow pagehide popstate '                   + // window
        'hashchange offline online '                                     + // window
        'afterprint beforeprint '                                        + // printing
        'dragstart dragenter dragover dragleave drag drop dragend '      + // dnd
        'loadstart progress suspend emptied stalled loadmetadata '       + // media
        'loadeddata canplay canplaythrough playing waiting seeking '     + // media
        'seeked ended durationchange timeupdate play pause ratechange '  + // media
        'volumechange cuechange '                                        + // media
        'checking noupdate downloading cached updateready obsolete '       // appcache

      // convert to a hash for quick lookups
    , nativeEvents = (function (hash, events, i) {
        for (i = 0; i < events.length; i++) events[i] && (hash[events[i]] = 1)
        return hash
      }({}, str2arr(standardNativeEvents + (W3C_MODEL ? w3cNativeEvents : ''))))

      // custom events are events that we *fake*, they are not provided natively but
      // we can use native events to generate them
    , customEvents = (function () {
        var isAncestor = 'compareDocumentPosition' in root
              ? function (element, container) {
                  return container.compareDocumentPosition && (container.compareDocumentPosition(element) & 16) === 16
                }
              : 'contains' in root
                ? function (element, container) {
                    container = container.nodeType === 9 || container === window ? root : container
                    return container !== element && container.contains(element)
                  }
                : function (element, container) {
                    while (element = element.parentNode) if (element === container) return 1
                    return 0
                  }
          , check = function (event) {
              var related = event.relatedTarget
              return !related
                ? related == null
                : (related !== this && related.prefix !== 'xul' && !/document/.test(this.toString())
                    && !isAncestor(related, this))
            }

        return {
            mouseenter: { base: 'mouseover', condition: check }
          , mouseleave: { base: 'mouseout', condition: check }
          , mousewheel: { base: /Firefox/.test(navigator.userAgent) ? 'DOMMouseScroll' : 'mousewheel' }
        }
      }())

      // we provide a consistent Event object across browsers by taking the actual DOM
      // event object and generating a new one from its properties.
    , Event = (function () {
            // a whitelist of properties (for different event types) tells us what to check for and copy
        var commonProps  = str2arr('altKey attrChange attrName bubbles cancelable ctrlKey currentTarget ' +
              'detail eventPhase getModifierState isTrusted metaKey relatedNode relatedTarget shiftKey '  +
              'srcElement target timeStamp type view which propertyName')
          , mouseProps   = commonProps.concat(str2arr('button buttons clientX clientY dataTransfer '      +
              'fromElement offsetX offsetY pageX pageY screenX screenY toElement'))
          , mouseWheelProps = mouseProps.concat(str2arr('wheelDelta wheelDeltaX wheelDeltaY wheelDeltaZ ' +
              'axis')) // 'axis' is FF specific
          , keyProps     = commonProps.concat(str2arr('char charCode key keyCode keyIdentifier '          +
              'keyLocation location'))
          , textProps    = commonProps.concat(str2arr('data'))
          , touchProps   = commonProps.concat(str2arr('touches targetTouches changedTouches scale rotation'))
          , messageProps = commonProps.concat(str2arr('data origin source'))
          , stateProps   = commonProps.concat(str2arr('state'))
          , overOutRegex = /over|out/
            // some event types need special handling and some need special properties, do that all here
          , typeFixers   = [
                { // key events
                    reg: /key/i
                  , fix: function (event, newEvent) {
                      newEvent.keyCode = event.keyCode || event.which
                      return keyProps
                    }
                }
              , { // mouse events
                    reg: /click|mouse(?!(.*wheel|scroll))|menu|drag|drop/i
                  , fix: function (event, newEvent, type) {
                      newEvent.rightClick = event.which === 3 || event.button === 2
                      newEvent.pos = { x: 0, y: 0 }
                      if (event.pageX || event.pageY) {
                        newEvent.clientX = event.pageX
                        newEvent.clientY = event.pageY
                      } else if (event.clientX || event.clientY) {
                        newEvent.clientX = event.clientX + doc.body.scrollLeft + root.scrollLeft
                        newEvent.clientY = event.clientY + doc.body.scrollTop + root.scrollTop
                      }
                      if (overOutRegex.test(type)) {
                        newEvent.relatedTarget = event.relatedTarget
                          || event[(type == 'mouseover' ? 'from' : 'to') + 'Element']
                      }
                      return mouseProps
                    }
                }
              , { // mouse wheel events
                    reg: /mouse.*(wheel|scroll)/i
                  , fix: function () { return mouseWheelProps }
                }
              , { // TextEvent
                    reg: /^text/i
                  , fix: function () { return textProps }
                }
              , { // touch and gesture events
                    reg: /^touch|^gesture/i
                  , fix: function () { return touchProps }
                }
              , { // message events
                    reg: /^message$/i
                  , fix: function () { return messageProps }
                }
              , { // popstate events
                    reg: /^popstate$/i
                  , fix: function () { return stateProps }
                }
              , { // everything else
                    reg: /.*/
                  , fix: function () { return commonProps }
                }
            ]
          , typeFixerMap = {} // used to map event types to fixer functions (above), a basic cache mechanism

          , Event = function (event, element, isNative) {
              if (!arguments.length) return
              event = event || ((element.ownerDocument || element.document || element).parentWindow || win).event
              this.originalEvent = event
              this.isNative       = isNative
              this.isBean         = true

              if (!event) return

              var type   = event.type
                , target = event.target || event.srcElement
                , i, l, p, props, fixer

              this.target = target && target.nodeType === 3 ? target.parentNode : target

              if (isNative) { // we only need basic augmentation on custom events, the rest expensive & pointless
                fixer = typeFixerMap[type]
                if (!fixer) { // haven't encountered this event type before, map a fixer function for it
                  for (i = 0, l = typeFixers.length; i < l; i++) {
                    if (typeFixers[i].reg.test(type)) { // guaranteed to match at least one, last is .*
                      typeFixerMap[type] = fixer = typeFixers[i].fix
                      break
                    }
                  }
                }

                props = fixer(event, this, type)
                for (i = props.length; i--;) {
                  if (!((p = props[i]) in this) && p in event) this[p] = event[p]
                }
              }
            }

        // preventDefault() and stopPropagation() are a consistent interface to those functions
        // on the DOM, stop() is an alias for both of them together
        Event.prototype.preventDefault = function () {
          if (this.originalEvent.preventDefault) this.originalEvent.preventDefault()
          else this.originalEvent.returnValue = false
        }
        Event.prototype.stopPropagation = function () {
          if (this.originalEvent.stopPropagation) this.originalEvent.stopPropagation()
          else this.originalEvent.cancelBubble = true
        }
        Event.prototype.stop = function () {
          this.preventDefault()
          this.stopPropagation()
          this.stopped = true
        }
        // stopImmediatePropagation() has to be handled internally because we manage the event list for
        // each element
        // note that originalElement may be a Bean#Event object in some situations
        Event.prototype.stopImmediatePropagation = function () {
          if (this.originalEvent.stopImmediatePropagation) this.originalEvent.stopImmediatePropagation()
          this.isImmediatePropagationStopped = function () { return true }
        }
        Event.prototype.isImmediatePropagationStopped = function () {
          return this.originalEvent.isImmediatePropagationStopped && this.originalEvent.isImmediatePropagationStopped()
        }
        Event.prototype.clone = function (currentTarget) {
          //TODO: this is ripe for optimisation, new events are *expensive*
          // improving this will speed up delegated events
          var ne = new Event(this, this.element, this.isNative)
          ne.currentTarget = currentTarget
          return ne
        }

        return Event
      }())

      // if we're in old IE we can't do onpropertychange on doc or win so we use doc.documentElement for both
    , targetElement = function (element, isNative) {
        return !W3C_MODEL && !isNative && (element === doc || element === win) ? root : element
      }

      /**
        * Bean maintains an internal registry for event listeners. We don't touch elements, objects
        * or functions to identify them, instead we store everything in the registry.
        * Each event listener has a RegEntry object, we have one 'registry' for the whole instance.
        */
    , RegEntry = (function () {
        // each handler is wrapped so we can handle delegation and custom events
        var wrappedHandler = function (element, fn, condition, args) {
            var call = function (event, eargs) {
                  return fn.apply(element, args ? slice.call(eargs, event ? 0 : 1).concat(args) : eargs)
                }
              , findTarget = function (event, eventElement) {
                  return fn.__beanDel ? fn.__beanDel.ft(event.target, element) : eventElement
                }
              , handler = condition
                  ? function (event) {
                      var target = findTarget(event, this) // deleated event
                      if (condition.apply(target, arguments)) {
                        if (event) event.currentTarget = target
                        return call(event, arguments)
                      }
                    }
                  : function (event) {
                      if (fn.__beanDel) event = event.clone(findTarget(event)) // delegated event, fix the fix
                      return call(event, arguments)
                    }
            handler.__beanDel = fn.__beanDel
            return handler
          }

        , RegEntry = function (element, type, handler, original, namespaces, args, root) {
            var customType     = customEvents[type]
              , isNative

            if (type == 'unload') {
              // self clean-up
              handler = once(removeListener, element, type, handler, original)
            }

            if (customType) {
              if (customType.condition) {
                handler = wrappedHandler(element, handler, customType.condition, args)
              }
              type = customType.base || type
            }

            this.isNative      = isNative = nativeEvents[type] && !!element[eventSupport]
            this.customType    = !W3C_MODEL && !isNative && type
            this.element       = element
            this.type          = type
            this.original      = original
            this.namespaces    = namespaces
            this.eventType     = W3C_MODEL || isNative ? type : 'propertychange'
            this.target        = targetElement(element, isNative)
            this[eventSupport] = !!this.target[eventSupport]
            this.root          = root
            this.handler       = wrappedHandler(element, handler, null, args)
          }

        // given a list of namespaces, is our entry in any of them?
        RegEntry.prototype.inNamespaces = function (checkNamespaces) {
          var i, j, c = 0
          if (!checkNamespaces) return true
          if (!this.namespaces) return false
          for (i = checkNamespaces.length; i--;) {
            for (j = this.namespaces.length; j--;) {
              if (checkNamespaces[i] == this.namespaces[j]) c++
            }
          }
          return checkNamespaces.length === c
        }

        // match by element, original fn (opt), handler fn (opt)
        RegEntry.prototype.matches = function (checkElement, checkOriginal, checkHandler) {
          return this.element === checkElement &&
            (!checkOriginal || this.original === checkOriginal) &&
            (!checkHandler || this.handler === checkHandler)
        }

        return RegEntry
      }())

    , registry = (function () {
        // our map stores arrays by event type, just because it's better than storing
        // everything in a single array.
        // uses '$' as a prefix for the keys for safety and 'r' as a special prefix for
        // rootListeners so we can look them up fast
        var map = {}

          // generic functional search of our registry for matching listeners,
          // `fn` returns false to break out of the loop
          , forAll = function (element, type, original, handler, root, fn) {
              var pfx = root ? 'r' : '$'
              if (!type || type == '*') {
                // search the whole registry
                for (var t in map) {
                  if (t.charAt(0) == pfx) {
                    forAll(element, t.substr(1), original, handler, root, fn)
                  }
                }
              } else {
                var i = 0, l, list = map[pfx + type], all = element == '*'
                if (!list) return
                for (l = list.length; i < l; i++) {
                  if ((all || list[i].matches(element, original, handler)) && !fn(list[i], list, i, type)) return
                }
              }
            }

          , has = function (element, type, original, root) {
              // we're not using forAll here simply because it's a bit slower and this
              // needs to be fast
              var i, list = map[(root ? 'r' : '$') + type]
              if (list) {
                for (i = list.length; i--;) {
                  if (!list[i].root && list[i].matches(element, original, null)) return true
                }
              }
              return false
            }

          , get = function (element, type, original, root) {
              var entries = []
              forAll(element, type, original, null, root, function (entry) {
                return entries.push(entry)
              })
              return entries
            }

          , put = function (entry) {
              var has = !entry.root && !this.has(entry.element, entry.type, null, false)
                , key = (entry.root ? 'r' : '$') + entry.type
              ;(map[key] || (map[key] = [])).push(entry)
              return has
            }

          , del = function (entry) {
              forAll(entry.element, entry.type, null, entry.handler, entry.root, function (entry, list, i) {
                list.splice(i, 1)
                entry.removed = true
                if (list.length === 0) delete map[(entry.root ? 'r' : '$') + entry.type]
                return false
              })
            }

            // dump all entries, used for onunload
          , entries = function () {
              var t, entries = []
              for (t in map) {
                if (t.charAt(0) == '$') entries = entries.concat(map[t])
              }
              return entries
            }

        return { has: has, get: get, put: put, del: del, entries: entries }
      }())

      // we need a selector engine for delegated events, use querySelectorAll if it exists
      // but for older browsers we need Qwery, Sizzle or similar
    , selectorEngine
    , setSelectorEngine = function (e) {
        if (!arguments.length) {
          selectorEngine = doc.querySelectorAll
            ? function (s, r) {
                return r.querySelectorAll(s)
              }
            : function () {
                throw new Error('Bean: No selector engine installed') // eeek
              }
        } else {
          selectorEngine = e
        }
      }

      // we attach this listener to each DOM event that we need to listen to, only once
      // per event type per DOM element
    , rootListener = function (event, type) {
        if (!W3C_MODEL && type && event && event.propertyName != '_on' + type) return

        var listeners = registry.get(this, type || event.type, null, false)
          , l = listeners.length
          , i = 0

        event = new Event(event, this, true)
        if (type) event.type = type

        // iterate through all handlers registered for this type, calling them unless they have
        // been removed by a previous handler or stopImmediatePropagation() has been called
        for (; i < l && !event.isImmediatePropagationStopped(); i++) {
          if (!listeners[i].removed) listeners[i].handler.call(this, event)
        }
      }

      // add and remove listeners to DOM elements
    , listener = W3C_MODEL
        ? function (element, type, add) {
            // new browsers
            element[add ? addEvent : removeEvent](type, rootListener, false)
          }
        : function (element, type, add, custom) {
            // IE8 and below, use attachEvent/detachEvent and we have to piggy-back propertychange events
            // to simulate event bubbling etc.
            var entry
            if (add) {
              registry.put(entry = new RegEntry(
                  element
                , custom || type
                , function (event) { // handler
                    rootListener.call(element, event, custom)
                  }
                , rootListener
                , null
                , null
                , true // is root
              ))
              if (custom && element['_on' + custom] == null) element['_on' + custom] = 0
              entry.target.attachEvent('on' + entry.eventType, entry.handler)
            } else {
              entry = registry.get(element, custom || type, rootListener, true)[0]
              if (entry) {
                entry.target.detachEvent('on' + entry.eventType, entry.handler)
                registry.del(entry)
              }
            }
          }

    , once = function (rm, element, type, fn, originalFn) {
        // wrap the handler in a handler that does a remove as well
        return function () {
          fn.apply(this, arguments)
          rm(element, type, originalFn)
        }
      }

    , removeListener = function (element, orgType, handler, namespaces) {
        var type     = orgType && orgType.replace(nameRegex, '')
          , handlers = registry.get(element, type, null, false)
          , removed  = {}
          , i, l

        for (i = 0, l = handlers.length; i < l; i++) {
          if ((!handler || handlers[i].original === handler) && handlers[i].inNamespaces(namespaces)) {
            // TODO: this is problematic, we have a registry.get() and registry.del() that
            // both do registry searches so we waste cycles doing this. Needs to be rolled into
            // a single registry.forAll(fn) that removes while finding, but the catch is that
            // we'll be splicing the arrays that we're iterating over. Needs extra tests to
            // make sure we don't screw it up. @rvagg
            registry.del(handlers[i])
            if (!removed[handlers[i].eventType] && handlers[i][eventSupport])
              removed[handlers[i].eventType] = { t: handlers[i].eventType, c: handlers[i].type }
          }
        }
        // check each type/element for removed listeners and remove the rootListener where it's no longer needed
        for (i in removed) {
          if (!registry.has(element, removed[i].t, null, false)) {
            // last listener of this type, remove the rootListener
            listener(element, removed[i].t, false, removed[i].c)
          }
        }
      }

      // set up a delegate helper using the given selector, wrap the handler function
    , delegate = function (selector, fn) {
        //TODO: findTarget (therefore $) is called twice, once for match and once for
        // setting e.currentTarget, fix this so it's only needed once
        var findTarget = function (target, root) {
              var i, array = isString(selector) ? selectorEngine(selector, root) : selector
              for (; target && target !== root; target = target.parentNode) {
                for (i = array.length; i--;) {
                  if (array[i] === target) return target
                }
              }
            }
          , handler = function (e) {
              var match = findTarget(e.target, this)
              if (match) fn.apply(match, arguments)
            }

        // __beanDel isn't pleasant but it's a private function, not exposed outside of Bean
        handler.__beanDel = {
            ft       : findTarget // attach it here for customEvents to use too
          , selector : selector
        }
        return handler
      }

    , fireListener = W3C_MODEL ? function (isNative, type, element) {
        // modern browsers, do a proper dispatchEvent()
        var evt = doc.createEvent(isNative ? 'HTMLEvents' : 'UIEvents')
        evt[isNative ? 'initEvent' : 'initUIEvent'](type, true, true, win, 1)
        element.dispatchEvent(evt)
      } : function (isNative, type, element) {
        // old browser use onpropertychange, just increment a custom property to trigger the event
        element = targetElement(element, isNative)
        isNative ? element.fireEvent('on' + type, doc.createEventObject()) : element['_on' + type]++
      }

      /**
        * Public API: off(), on(), add(), (remove()), one(), fire(), clone()
        */

      /**
        * off(element[, eventType(s)[, handler ]])
        */
    , off = function (element, typeSpec, fn) {
        var isTypeStr = isString(typeSpec)
          , k, type, namespaces, i

        if (isTypeStr && typeSpec.indexOf(' ') > 0) {
          // off(el, 't1 t2 t3', fn) or off(el, 't1 t2 t3')
          typeSpec = str2arr(typeSpec)
          for (i = typeSpec.length; i--;)
            off(element, typeSpec[i], fn)
          return element
        }

        type = isTypeStr && typeSpec.replace(nameRegex, '')
        if (type && customEvents[type]) type = customEvents[type].base

        if (!typeSpec || isTypeStr) {
          // off(el) or off(el, t1.ns) or off(el, .ns) or off(el, .ns1.ns2.ns3)
          if (namespaces = isTypeStr && typeSpec.replace(namespaceRegex, '')) namespaces = str2arr(namespaces, '.')
          removeListener(element, type, fn, namespaces)
        } else if (isFunction(typeSpec)) {
          // off(el, fn)
          removeListener(element, null, typeSpec)
        } else {
          // off(el, { t1: fn1, t2, fn2 })
          for (k in typeSpec) {
            if (typeSpec.hasOwnProperty(k)) off(element, k, typeSpec[k])
          }
        }

        return element
      }

      /**
        * on(element, eventType(s)[, selector], handler[, args ])
        */
    , on = function(element, events, selector, fn) {
        var originalFn, type, types, i, args, entry, first

        //TODO: the undefined check means you can't pass an 'args' argument, fix this perhaps?
        if (selector === undefined && typeof events == 'object') {
          //TODO: this can't handle delegated events
          for (type in events) {
            if (events.hasOwnProperty(type)) {
              on.call(this, element, type, events[type])
            }
          }
          return
        }

        if (!isFunction(selector)) {
          // delegated event
          originalFn = fn
          args       = slice.call(arguments, 4)
          fn         = delegate(selector, originalFn, selectorEngine)
        } else {
          args       = slice.call(arguments, 3)
          fn         = originalFn = selector
        }

        types = str2arr(events)

        // special case for one(), wrap in a self-removing handler
        if (this === ONE) {
          fn = once(off, element, events, fn, originalFn)
        }

        for (i = types.length; i--;) {
          // add new handler to the registry and check if it's the first for this element/type
          first = registry.put(entry = new RegEntry(
              element
            , types[i].replace(nameRegex, '') // event type
            , fn
            , originalFn
            , str2arr(types[i].replace(namespaceRegex, ''), '.') // namespaces
            , args
            , false // not root
          ))
          if (entry[eventSupport] && first) {
            // first event of this type on this element, add root listener
            listener(element, entry.eventType, true, entry.customType)
          }
        }

        return element
      }

      /**
        * add(element[, selector], eventType(s), handler[, args ])
        *
        * Deprecated: kept (for now) for backward-compatibility
        */
    , add = function (element, events, fn, delfn) {
        return on.apply(
            null
          , !isString(fn)
              ? slice.call(arguments)
              : [ element, fn, events, delfn ].concat(arguments.length > 3 ? slice.call(arguments, 5) : [])
        )
      }

      /**
        * one(element, eventType(s)[, selector], handler[, args ])
        */
    , one = function () {
        return on.apply(ONE, arguments)
      }

      /**
        * fire(element, eventType(s)[, args ])
        *
        * The optional 'args' argument must be an array, if no 'args' argument is provided
        * then we can use the browser's DOM event system, otherwise we trigger handlers manually
        */
    , fire = function (element, type, args) {
        var types = str2arr(type)
          , i, j, l, names, handlers

        for (i = types.length; i--;) {
          type = types[i].replace(nameRegex, '')
          if (names = types[i].replace(namespaceRegex, '')) names = str2arr(names, '.')
          if (!names && !args && element[eventSupport]) {
            fireListener(nativeEvents[type], type, element)
          } else {
            // non-native event, either because of a namespace, arguments or a non DOM element
            // iterate over all listeners and manually 'fire'
            handlers = registry.get(element, type, null, false)
            args = [false].concat(args)
            for (j = 0, l = handlers.length; j < l; j++) {
              if (handlers[j].inNamespaces(names)) {
                handlers[j].handler.apply(element, args)
              }
            }
          }
        }
        return element
      }

      /**
        * clone(dstElement, srcElement[, eventType ])
        *
        * TODO: perhaps for consistency we should allow the same flexibility in type specifiers?
        */
    , clone = function (element, from, type) {
        var handlers = registry.get(from, type, null, false)
          , l = handlers.length
          , i = 0
          , args, beanDel

        for (; i < l; i++) {
          if (handlers[i].original) {
            args = [ element, handlers[i].type ]
            if (beanDel = handlers[i].handler.__beanDel) args.push(beanDel.selector)
            args.push(handlers[i].original)
            on.apply(null, args)
          }
        }
        return element
      }

    , bean = {
          on                : on
        , add               : add
        , one               : one
        , off               : off
        , remove            : off
        , clone             : clone
        , fire              : fire
        , Event             : Event
        , setSelectorEngine : setSelectorEngine
        , noConflict        : function () {
            context[name] = old
            return this
          }
      }

  // for IE, clean up on unload to avoid leaks
  if (win.attachEvent) {
    var cleanup = function () {
      var i, entries = registry.entries()
      for (i in entries) {
        if (entries[i].type && entries[i].type !== 'unload') off(entries[i].element, entries[i].type)
      }
      win.detachEvent('onunload', cleanup)
      win.CollectGarbage && win.CollectGarbage()
    }
    win.attachEvent('onunload', cleanup)
  }

  // initialize selector engine to internal default (qSA or throw Error)
  setSelectorEngine()

  return bean
});
});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/compiler.model.js",function(require,module,exports,__dirname,__filename,process,global){var _            = require('underscore')
var curry        = require('curry')
var Request      = require('./http.model').Request
var StoreRequest = require('./http.model').StoreRequest
var editorModel  = require('./editor.model')

// String -> Boolean
function sourceIsEmpty(str) {
  return str.replace(/\s+/g, '') == ""
}

// Editor -> Editor
function compile(s) {
  if (sourceIsEmpty(s.sourcecode)) {
    return s
  } else {
    return _.extend(s, { 
      requests: s.requests.concat([Request(Request.POST, '/sprout', StoreRequest(s.category, s.sourcecode), editorModel.EditorFromStoreResponse)])
    })
  }
}

// String -> Editor -> Editor
var compileAs = curry(function (category, s) {
  return compile(_.extend(s, {category: category}));
})

module.exports = {
  compile:       compile,
  compileAs:     compileAs,
  sourceIsEmpty: sourceIsEmpty
}

});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/gist.js",function(require,module,exports,__dirname,__filename,process,global){var curry         = require('curry')
var http          = require('iris').http
var update        = require('./ui.update')
var state         = require('./ui.state')
var on            = require('./ui.event').on
var onCompileGist = on('click', '#compile-gist')
var onImportGist  = on('click', '#import-gist')

function isValidGistID(rawStr) {
  return rawStr.match(/^[a-fA-F0-9]+$/) != null
}

var gistAction = function (fn) {
  return function () {
    var gistID = state.inputValueByName('gist_url')
    if (isValidGistID(gistID)) {
      return fn(gistID)
    }
  }
}

var viewGist = gistAction(function (gistID) {
  update.locationHref('/gists/' + gistID)
})

var importGist = gistAction(function (gistID) {
  return http.get('/gists/' + gistID + '/import')
})

var spinImportIcon = gistAction(function (gistID) {
  update.activateSpin(state.query('.secondary .icon-github-alt')[0])
})

var loadGistImport = function (id) {
  update.locationHref('/sprout/' + id)
}

module.exports = {

  init: function () {

    onCompileGist(viewGist)

    onImportGist(function () {
      importGist().ok(loadGistImport)
    })

    onImportGist(spinImportIcon)
  }

}

});

require.define("/projects/repos/share-elm/src/main/resources/theme/js/src/main.js",function(require,module,exports,__dirname,__filename,process,global){var editor = require('./editor')
var gist   = require('./gist')

editor.init()
gist.init()

});
require("/projects/repos/share-elm/src/main/resources/theme/js/src/main.js");
})();

