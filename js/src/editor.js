var _        = require('underscore')
var curry    = require('curry')
var http     = require('iris').http
var ui       = require('./ui.state')
var history  = ui.history
var on       = require('./ui.event').on
var core     = require('./core')
var mval     = core.mval
var fval     = core.fval
var rval     = core.rval
var rstate   = core.rstate
var sequence = core.sequence

/* MODEL */

// String -> String
function editorPath(id) {
  return '/sprout/' + id
}

// String -> String
function fullviewPath(id) {
  return editorPath(id) + '/view'
}

// {getValue, setValue} -> {Source}
function sourceAPI(io) {
  return { 
    asText: function () { return io.getValue() },
    update: function(v) { io.setValue(v) } 
  }
}

// AppState -> MVal[Promise]
function compile(state) {
  return mval(http.post('/sprout', {body: state}), state);
}

// AppState -> Boolean
function sourceIsEmpty(app) {
  return rstate(app).sourcecode.replace(/\s+/g, '') == ""
}

// String -> AppState -> MVal[Promise]
var compileAs = curry(function (category, state) {
  return fval(compile(_.extend(state, {category: category})));
})

// MVal[_,AppState] -> {StorableHistory}
function rhistory(val) {
  var state = rstate(val)
  // (can't just store AppState in DOM history because an object with functions breaks it)
  return {
    sourcecode: state.source.asText(), 
    preview:    state.ui.preview.asHTML(), 
    category:   state.category
  }
}

/* UPDATE */

// String -> String -> MVal[AppSignal] -> MVal[AppSignal]
var addCompilationHandler = curry(function (selector, category, app) {
  var newApp = mval(rval(app), _.extend(rstate(app), {category: category}))
  on('click', selector, function () { 
    compilationSequence(newApp)(newApp) 
  })
  return newApp
})

// MVal[AppSignal,AppState] -> AppState
function nextAppState(app) {
  return rval(app)()
}

// MVal[AppSignal,AppState] -> Computation[MVal[AppSignal]]
function compilationSequence(app) {
  return sequence(
    nextAppState,
    compileAs(rstate(app).category),
    updatePreview,
    updateUIControls,
    updateHistoryFromCompilation
  )
}

// MVal[_,AppState] -> DOMEvent -> ()
var updateUIFromHistory = curry(function (val, event) {
  if (event.state) {
    rstate(val).source.update(event.state.sourcecode)
    rstate(val).ui.preview.update(document.location.pathname + '/view')
  }
})

// MVal[_,AppState] -> ()
function initAutoUpdateSaveButton(app) {
  var state = rstate(app)
  var lastCheckedSource = state.source.asText()
  setInterval(function () {
    var currentSource = state.source.asText()
    if (currentSource != lastCheckedSource) {
      state.ui.show('#save')
      lastCheckedSource = currentSource
    }
  }, 700)
}

/* DISPLAY */

// {Source} -> {UI}
function mkStateSignal(sourceState, ui) {
  return function () {
    return { 
      ui: ui,
      source: sourceState,
      sourcecode: sourceState.asText(), 
      preview: ui.preview.asHTML(), 
      category: ui.query('#editor input[name=category]')[0].value
    }
  }
}

// MVal[Promise,AppState] -> MVal[Promise,AppState]
function updatePreview(val) {
  rval(val)
    .ok(function (id) {
      rstate(val).ui.preview.update(fullviewPath(id))
    })
    .failed(function(data) {
      rstate(val).ui.preview.showError()
    })
  return val
}

// MVal[Promise,AppState] -> MVal[Promise,AppState]
function updateUIControls(val) {
  rval(val)
    .ok(function (id) {
      if (rstate(val).category == "saved") {
        rstate(val).ui.hide("#save")
      }
    })
  return val
}

// MVal[Promise,AppState] -> MVal[Promise,AppState]
function updateHistoryFromCompilation(val) {
  rval(val)
    .ok(function (id) {
      rstate(val).ui.history.update(editorPath(id), rhistory(val))
    })
  return val
}

// (MVal[_,AppState] -> ()) -> MVal[_,AppState]
var addHistoryHandler = curry(function (fn, app) {
  window.onpopstate = fn(app)
  return app
})

module.exports = {
  init: function () {

    // Initial State

    var appSignal = mkStateSignal(
      sourceAPI(CodeMirror.fromTextArea(ui.query("#sourcecode")[0], {theme: "solarized"})),
      ui
    )
    var initialState = appSignal()
    var app = mval(appSignal, initialState)

    // Boot

    history.update(document.location, rhistory(app))
    if (!sourceIsEmpty(app)) compilationSequence(app)(app)

    // Event Handlers and Auto Update

    sequence(
      addHistoryHandler(updateUIFromHistory),
      addCompilationHandler("#compile", "draft"),
      addCompilationHandler("#save", "saved"),
      initAutoUpdateSaveButton
    )(app)

  }
}
