var core       = require("../core.js")
var hasWord    = core.hasWord
var removeWord = core.removeWord
var M          = core.M

var assert = require("assert")

describe('Core', function(){
  describe('#hasWord()', function(){
    it('should correctly find words in strings', function(){
      var x = "active inactive ";
      assert.equal(hasWord("active", x), true)
      assert.equal(hasWord("inactive", x), true)
      assert.equal(hasWord("act", x), false, "should not find words within words")
    })
  })

  describe('#removeWord()', function(){
    it('should correctly remove words from strings', function(){
      var x = "active inactive ";
      assert.equal(removeWord("active", x), " inactive ")
    })
  })

  describe('#M()', function(){
    var a = 42
    var n = function (v) { return M.unit(v) }
    var o = function (v) { return M.unit(v) }
    var m = M.unit(a)

    it('should check for equality properly', function(){
      assert.equal(M.eq(m, M.unit(a)), true)
    })

    it('should satisfy the three basic monad laws', function(){
      assert.equal(M.eq(M.chain(m, function (b) { return n(b) }), n(a)), true, "Left unit")
      assert.equal(M.eq(M.chain(m, function (a) { return M.unit(a) }), m), true, "Right unit")
      assert.equal(
        M.eq(
          M.chain(m, function (a) { return M.chain(n(a), function (b) { return o(b) } ) }),
          M.chain(M.chain(m, function (a) { return n(a) }), function (b) { return o(b) })
        ),
        true,
        "Associative"
      )
      assert.equal(true, true)
    })
  })
})
