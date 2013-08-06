var curry    = require('curry')
var http     = require('iris').http
var ui_state = require('./ui.state')
var on       = require('./ui.event').on
var onCompileGist = on('click', '#compile-gist')
var onImportGist  = on('click', '#import-gist')

function isValidGistID(rawStr) {
  return rawStr.match(/^[a-fA-F0-9]+$/) != null
}

var gistAction = curry(function (ui, fn) {
  return function () {
    var gistID = ui.inputValueByName('gist_url')
    if (isValidGistID(gistID)) {
      return fn(ui, gistID)
    }
  }
})(ui_state)

var viewGist = gistAction(function (ui, gistID) {
  ui.updateLocationHref('/gists/' + gistID)
})

var importGist = gistAction(function (ui, gistID) {
  return http.get('/gists/' + gistID + '/import')
})

var spinImportIcon = gistAction(function (ui, gistID) {
  ui.activateSpin(ui.query('.secondary .icon-github-alt')[0])
})

var loadGistImport = curry(function (ui, id) {
  ui.updateLocationHref('/sprout/' + id)
})(ui_state)

module.exports = {

  init: function () {

    onCompileGist(viewGist)

    onImportGist(function () {
      importGist().ok(loadGistImport)
    })

    onImportGist(spinImportIcon)
  }

}
