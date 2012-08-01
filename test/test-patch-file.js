var expect = require('expect.js'),
    fs = require('fs'),
    patchFile = require('../patch-file'),
    makePatch = patchFile.makePatch,
    DMP = require('../diff_match_patch_uncompressed');

describe("patchText()", function() {
  it("should report malformed patch strings", function(done) {
    patchFile.patchText('lol', 'u', function(err, newText) {
      expect(err.message).to.be('Invalid patch string: u');
      done();
    });
  });
  
  it("should apply valid patches to pristine text", function(done) {
    var patch = makePatch('hwllo', 'hello');
    patchFile.patchText('hwllo', patch, function(err, newText) {
      if (err) return done(err);
      expect(newText).to.be('hello');
      done();
    });
  });

  it("should apply valid patches to changed text", function(done) {
    var patch = makePatch('hwllo', 'hello');
    patchFile.patchText('hwllo there', patch, function(err, newText) {
      if (err) return done(err);
      expect(newText).to.be('hello there');
      done();
    });
  });
  
  it("should report unapplicable patches", function(done) {
    var patch = makePatch('hwllo', 'hello');
    patchFile.patchText('BOOF', patch, function(err, newText) {
      expect(err.message).to.be('Unable to apply 1 of 1 hunk(s)');
      done();
    });
  });
});

describe("patchFile()", function() {
  var TEST_FILE = '_testfile.txt';
  
  function clearFile() {
    if (fs.existsSync(TEST_FILE))
      fs.unlinkSync(TEST_FILE);
  }
  
  beforeEach(clearFile);
  afterEach(clearFile);
  
  it("should patch files", function(done) {
    var patch = makePatch('hwllo\u2026', 'hello\u2026');
    fs.writeFileSync(TEST_FILE, 'hwllo\u2026');
    patchFile.patchFile(TEST_FILE, patch, function(err) {
      if (err) return done(err);
      expect(fs.readFileSync(TEST_FILE, 'utf8')).to.be('hello\u2026');
      done();
    });
  });

  it("should report errors on nonexistent files", function(done) {
    var patch = makePatch('hwllo', 'hello');
    patchFile.patchFile(TEST_FILE, patch, function(err) {
      expect(err.message).to.be('ENOENT, open \'_testfile.txt\'');
      done();
    });
  });

  it("should report errors on unpatchable files", function(done) {
    var patch = makePatch('hwllo', 'hello');
    fs.writeFileSync(TEST_FILE, 'BOOP');
    patchFile.patchFile(TEST_FILE, patch, function(err) {
      expect(err.message).to.be('Unable to apply 1 of 1 hunk(s)');
      done();
    });
  });
});
