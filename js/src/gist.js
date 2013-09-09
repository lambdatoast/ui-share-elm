var curry         = require('curry')
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
