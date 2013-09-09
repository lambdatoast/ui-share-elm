var state  = require('./ui.state')
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

