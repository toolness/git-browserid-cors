var expect = require('expect.js'),
    fs = require('fs'),
    path = require('path'),
    exec =  require('child_process').exec,
    Git = require('../git');

describe('Git', function() {
  var rootDir = __dirname + '/../_testrepo';
  
  function nukeRootDir(cb) {
    if (fs.existsSync(rootDir))
      exec('rm -rf ' + rootDir, cb);
    else
      cb(null);
  }
  
  beforeEach(function(done) {
    nukeRootDir(function(err) {
      if (err) throw err;
      fs.mkdirSync(rootDir);
      done();
    });
  });
  
  afterEach(nukeRootDir);
  
  it('init() should work', function(done) {
    var git = Git({rootDir: rootDir, debug: true});

    git.init(function(err) {
      expect(err).to.be(null);
      expect(fs.existsSync(git.abspath('.git'))).to.be(true);
      done();
    });
  });
  
  it('revert() should work', function(done) {
    var git = Git({rootDir: rootDir, debug: true});
    
    git.init()
      .addFile('blah.txt', 'hello there')
      .commit({author: 'Foo <foo@foo.org>', message: 'origination.'})
      .addFile('blah.txt', 'goodbye yo')
      .commit({
        author: 'Foo <foo@foo.org>',
        message: 'changed file.'
      }, function(err) {
        if (err) return done(err);
        expect(fs.readFileSync(git.abspath('blah.txt'), 'utf8'))
          .to.be('goodbye yo');
        git.revert(function(err) {
          if (err) return done(err);
          expect(fs.readFileSync(git.abspath('blah.txt'), 'utf8'))
            .to.be('hello there');
          done();
        });
      });
  });
});
