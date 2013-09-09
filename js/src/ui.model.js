// UIElement = { selector:String }

// String -> UIElement
function UIElement(selector) {
  return { selector: selector }
}

// { compile:DisplayState, save:DisplayState, view:DisplayState }
function UIButtons(compile, save, view) {
  return {
    compile: compile,
    save:    save,
    view:    view
  }
}
UIButtons.Show = "show"
UIButtons.Hide = "hide"

module.exports = {
  UIElement: UIElement,
  UIButtons: UIButtons
}
