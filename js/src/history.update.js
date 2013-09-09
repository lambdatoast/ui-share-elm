// String -> HistoryRecord
function updateHistory(url, r) {
  window.history.pushState(r, "", url)
}

module.exports = updateHistory

