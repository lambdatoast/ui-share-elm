var _         = require('underscore')
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
