var bean  = require('bean')
var curry = require('curry')

var on = curry(function (eventType, selector, handler) {
  bean.on(document, eventType, selector, function (e) {
    e.preventDefault()
    handler()
  });
})

module.exports = {
  on: on
}
