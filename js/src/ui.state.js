var query = require('./ui.query')

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

