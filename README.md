# Old UI for share-elm.com

NOTE: This is no longer the same codebase as share-elm.com's frontend. The actual codebase (front end and back end) will be open sourced at some point in 2015.

Requires [node](http://nodejs.org/) and [browserify](https://github.com/substack/node-browserify) for building and testing the source files.

Other requirements are [bean](https://npmjs.org/package/bean), [iris](https://npmjs.org/package/iris), [curry](https://npmjs.org/package/curry), and [underscore](https://npmjs.org/package/underscore) modules, all available through the node package manager. 

CodeMirror and other libs that are currently used are declared directly in the markup of index.html. 

index.html is an example file. The actual site uses a modified version to fit the server-side template engine.

NOTE: This is very alpha and will probably be changing radically, as share-elm.com is a fresh site with goals that are not set in stone.

## Building

The only thing that has to be built is the main.js that is imported by the app. To build that just run browserify on the src/main.js source file, i.e. `browserify js/src/main.js > js/main.js`.

