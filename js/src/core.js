var _              = require('underscore')

// String helpers

function hasWord(w, s) {
  var r = new RegExp('\\b' + w + '\\b')
  return r.test(s)
}

function addWord(w, s) {
  if (hasWord(s, w)) {
    return w
  }
  return s + " " + w;
}

function removeWord(w, s) {
  var r = new RegExp('\\b' + w + '\\b')
  return s.replace(r, '')
}

// Generic State Monad

// M a = (State, a)
function M(s, a) {
  return [s, a]
}
// a -> M a
M.unit = function (a) {
  return M(undefined, a)
}
// Ma -> (a -> M b) -> Mb
M.chain = function (m, k) {
  var x = m[0], a = m[1]
  var mb = k(a), y = mb[0], b = mb[1]
  return M(_.extend(x,y), b)
}
// State -> M ()
M.state = function (s) {
  return M(s, undefined)
}
// M a -> M a -> Boolean
M.eq = function (ma, mb) {
  return ma[0] === mb[0] && ma[1] === mb[1]
}

module.exports = {
  hasWord:    hasWord,
  addWord:    addWord,
  removeWord: removeWord,

  M:          M
}
