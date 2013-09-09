var curry  = require('curry')
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
