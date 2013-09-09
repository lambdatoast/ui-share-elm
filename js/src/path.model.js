// String -> String
function editorPath(id) {
  return '/sprout/' + id
}

// String -> String
function fullviewPath(id, version) {
  return editorPath(id) + '/' + version + '/view'
}

module.exports = {
  editor: editorPath,
  fullView: fullviewPath
}
