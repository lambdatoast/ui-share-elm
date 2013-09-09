var bean  = require('bean')
var curry = require('curry')

var on = curry(function (eventType, selector, handler) {
  bean.on(document, eventType, selector, function (e) {
    e.preventDefault()
    handler()
  });
})

// EventProcessor = Signal[A] -> (EditorState -> EditorState) -> ()
// String -> UIElement -> (EditorState -> EditorState) -> (Stream[A] -> EventProcessor -> ())
var listener = curry(function (eventType, UIElement, f) {
  return function (signal, eventProcessor) {
    on(eventType, UIElement.selector, function (e) { 
      eventProcessor(signal, f)
    })
  }
})

var clickListener = listener("click")

var changeListener = listener("change")

module.exports = {
  on: on,
  listener: listener,
  clickListener: clickListener,
  changeListener: changeListener
}
