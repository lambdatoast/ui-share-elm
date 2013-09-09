var _            = require('underscore')
var curry        = require('curry')
var Request      = require('./http.model').Request
var StoreRequest = require('./http.model').StoreRequest
var editorModel  = require('./editor.model')

// String -> Boolean
function sourceIsEmpty(str) {
  return str.replace(/\s+/g, '') == ""
}

// Editor -> Editor
function compile(s) {
  if (sourceIsEmpty(s.sourcecode)) {
    return s
  } else {
    return _.extend(s, { 
      requests: s.requests.concat([Request(Request.POST, '/sprout', StoreRequest(s.category, s.sourcecode), editorModel.EditorFromStoreResponse)])
    })
  }
}

// String -> Editor -> Editor
var compileAs = curry(function (category, s) {
  return compile(_.extend(s, {category: category}));
})

module.exports = {
  compile:       compile,
  compileAs:     compileAs,
  sourceIsEmpty: sourceIsEmpty
}
