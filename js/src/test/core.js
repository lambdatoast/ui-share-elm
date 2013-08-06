var core       = require("../core.js")
var mval       = core.mval
var rval       = core.rval
var rstate     = core.rstate
var sequence   = core.sequence

var assert = require("assert")

describe('Core', function(){
  describe('#sequence()', function(){
    it('should create a computation pipeline that takes a stateSignal as first input', function(){

      function mkDummyStateSignal() {
        return "a"
      }

      var result = sequence(
        mkDummyStateSignal,
        function (state) { return mval(5, state) },
        function (val)   { return mval(rval(val) + 5, rstate(val) + "b") },
        function (val)   { return mval(rval(val) * 2, rstate(val) + "c") }
      )()

      assert.equal(rval(result), 20)
      assert.equal(rstate(result), "abc")
    })
  })
})
