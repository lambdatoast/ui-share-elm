var SourceSignal = require('./ui.state').SourceSignal
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
