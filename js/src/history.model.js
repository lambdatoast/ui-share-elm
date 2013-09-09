// String -> String -> String -> HistoryRecord
function HistoryRecord(route, category, sourcecode) {
  // (can't just store EditorState in DOM history because an object with functions breaks it)
  return {
    route:       route,
    category:    category,
    sourcecode:  sourcecode
  }
}

module.exports = {
  Record: HistoryRecord
}
