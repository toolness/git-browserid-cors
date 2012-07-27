var expect = require('expect.js'),
    fs = require('fs'),
    path = require('path'),
    exec =  require('child_process').exec,
    Git = require('../git');

describe('Git', function() {
  var rootDir = __dirname + '/../_testrepo',
      git;
  
  function nukeRootDir(cb) {
    if (fs.existsSync(rootDir))
      exec('rm -rf ' + rootDir, cb);
    else
      cb(null);
  }
  
  function contentsOf(filename) {
    return fs.readFileSync(git.abspath(filename), 'utf8');
  }
  
  beforeEach(function(done) {
    nukeRootDir(function(err) {
      if (err) throw err;
      fs.mkdirSync(rootDir);
      git = Git({rootDir: rootDir, debug: true});
      done();
    });
  });
  
  afterEach(nukeRootDir);
  
  it('should initialize repositories', function(done) {
    git.init(function(err) {
      expect(err).to.be(null);
      expect(fs.existsSync(git.abspath('.git'))).to.be(true);
      done();
    });
  });
  
  it('should revert commits', function(done) {
    git.init()
      .addFile('blah.txt', 'hello there')
      .commit({author: 'Foo <foo@foo.org>', message: 'origination.'})
      .addFile('blah.txt', 'goodbye yo')
      .commit({
        author: 'Foo <foo@foo.org>',
        message: 'changed file.'
      }, function(err) {
        if (err) return done(err);
        expect(contentsOf('blah.txt')).to.be('goodbye yo');
        git.revert(function(err) {
          if (err) return done(err);
          expect(contentsOf('blah.txt')).to.be('hello there');
          done();
        });
      });
  });
});
