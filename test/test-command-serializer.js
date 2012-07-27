var expect = require('expect.js'),
    CommandSerializer = require('../command-serializer');

describe("CommandSerializer", function() {
  it("should serialize command execution", function(done) {
    var cs = CommandSerializer();
    var log = [];
    var self = {
      a: cs.serialized(function(foo, cb) {
        expect(this).to.be(self);
        log.push("a(" + foo + "):" + cs.queue.length);
        setTimeout(function() { cb(null, foo); });
      })
    };

    self.a("bop", function(err, result) {
      expect(this).to.be(self);
      expect(result).to.be("bop");
      expect(log).to.eql(['a(bop):1']);
    }).a("slop", function(err, result) {
      expect(log).to.eql(['a(bop):1', 'a(slop):0']);
      done();
    });
  });
  
  it("should propagate errors", function(done) {
    var cs = CommandSerializer();
    var self = {
      timesCalled: 0,
      a: cs.serialized(function(err, cb) {
        this.timesCalled++;
        setTimeout(function() { cb(err); });
      })
    };

    self.a(null)
        .a(null)
        .a(null)
        .a("FAIL")
        .a(null, function(err) {
          expect(err).to.be("FAIL");
          expect(self.timesCalled).to.be(4);
        })
        .a(null, function(err) {
          expect(err).to.be(null);
          expect(self.timesCalled).to.be(5);
          done();
        });
  });
});
