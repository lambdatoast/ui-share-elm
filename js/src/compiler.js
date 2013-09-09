var UIElement      = require('./ui.model').UIElement
var clickListener  = require('./ui.event').clickListener
var changeListener = require('./ui.event').changeListener
var step           = require('./ui.update').step
var model          = require('./compiler.model')
var compile        = model.compile
var compileAs      = model.compileAs
var sourceIsEmpty  = model.sourceIsEmpty

// SourceIO -> ()
function initCompiler(source) {
  void [ 
    clickListener(UIElement("#compile"), compile),
    clickListener(UIElement("#save"), compileAs("saved")),
    changeListener(UIElement("#version"), compile)
  ].forEach(function (activateListener) {
    activateListener(source, step)
  })

  if (!sourceIsEmpty(source.read())) {
    step(source, compile)
  }
}

module.exports = {
  init: initCompiler
}
