var query         = require('./ui.query')
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
