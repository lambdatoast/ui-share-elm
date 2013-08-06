var addWord = require('./core').addWord

function query(selector) {
  return document.querySelectorAll(selector)
}

function css(el, k, v) {
  el.style[k] = v
}

function show(selector, style) {
  css(query(selector)[0], 'display', style || 'inline-block')
}

function hide(selector, style) {
  css(query(selector)[0], 'display', style || 'none')
}

function updateLocationHref(href) {
  window.location.href = href
}

function updateHistory(url, historyRecord) {
  window.history.pushState(historyRecord, "", url)
}

function updatePreviewForError() {
  hide('.actions .view')
  query('#preview')[0].innerHTML = 'There was a server error, try again in a bit.'
}

function updatePreview(fullViewURL) {
  query('#preview')[0].innerHTML = '<iframe src="' + fullViewURL + '"></iframe>'
  query('.actions .view')[0].href = fullViewURL
  show('.actions .view')
}

function previewAsHTML() {
  return query('#preview')[0].innerHTML
}

function inputValueByName(name) {
  return query('input[name=' + name + ']')[0].value
}

module.exports = {
  history: {
    update: updateHistory
  },
  preview: {
    showError: updatePreviewForError,
    update: updatePreview,
    asHTML: previewAsHTML
  },
  css: css,
  show: show,
  hide: hide,
  query: query,
  updateLocationHref: updateLocationHref,
  activateSpin: function (el) {
    el.className = addWord('icon-spin', el.className)
  },
  inputValueByName: inputValueByName
}

