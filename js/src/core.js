// String helpers

function hasWord(w, s) {
  var r = new RegExp('\b' + w + '\b')
  return r.test(s)
}

function addWord(w, s) {
  if (hasWord(s, w)) {
    return w
  }
  return s + " " + w;
}

function removeWord(w, s) {
  var r = new RegExp('\b' + w + '\b')
  return s.replace(r, '')
}

// General State Management

function mval(value, state) {
  return {value: value, state: state}
}

function fval(val) {
  return mval(rval(val), rstate(val))
}

function rval(val) {
  return val.value
}

function rstate(val) {
  return val.state
}

function fmap(fn) { 
  return function (val) {
    return mval(fn(rval(val)), rstate(val))
  }
}

function sequence(/* action1, action2, ... */) {
  var actions = [].slice.call(arguments)
  return function (val) {
    var result = actions.reduce(function (acc, fn) {
      return fn(acc)
    }, val)
    return result
  }
}

module.exports = {
  hasWord:    hasWord,
  addWord:    addWord,
  removeWord: removeWord,

  mval: mval,
  fval: fval,
  rval: rval,
  rstate: rstate,
  sequence: sequence
}
