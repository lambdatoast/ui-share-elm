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

// MODEL

function editorPath(id) {
  return '/sprout/' + id
}

function fullviewPath(id) {
  return editorPath(id) + '/view'
}

var sourceAPI = function (io) {
  return { 
    asText: function () { return io.getValue() },
    update: function(v) { io.setValue(v) } 
  }
}

function compile(state) {
  return mval(http.post('/sprout', {body: state}), state);
}

function sourceIsEmpty(val) {
  return rstate(val).sourcecode.replace(/\s+/g, '') == ""
}

var compileAs = curry(function (category, state) {
  return fval(compile(_.extend(state, {category: category})));
})

function rhistory(val) {
  var state = rstate(val)
  return {
    sourcecode: state.source.asText(), 
    preview:    state.ui.preview.asHTML(), 
    category:   state.category
  }
}

// UPDATE

var addCompilationHandler = curry(function (selector, category, app) {
  var newApp = mval(rval(app), _.extend(rstate(app), {category: category}))
  on('click', selector, function () { 
    compilationSequence(newApp)(newApp) 
  })
  return newApp
})

function nextAppState(app) {
  return rval(app)()
}

function compilationSequence(app) {
  return sequence(
    nextAppState,
    compileAs(rstate(app).category),
    updatePreview,
    updateUIControls,
    updateHistoryFromCompilation
  )
}

var updateUIFromHistory = curry(function (val, event) {
  if (event.state) {
    rstate(val).source.update(event.state.sourcecode)
    rstate(val).ui.preview.update(document.location.pathname + '/view')
  }
})

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

// DISPLAY

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

function updateUIControls(val) {
  rval(val)
    .ok(function (id) {
      if (rstate(val).category == "saved") {
        rstate(val).ui.hide("#save")
      }
    })
  return val
}

function updateHistoryFromCompilation(val) {
  rval(val)
    .ok(function (id) {
      rstate(val).ui.history.update(editorPath(id), rhistory(val))
    })
  return val
}

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
