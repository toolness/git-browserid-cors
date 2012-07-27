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
  
  it('should list committed files', function(done) {
    git.init()
      .addFile('blah.txt', 'hello there')
      .commit({author: 'Foo <foo@foo.org>', message: 'origination.'})
      .listFiles(function(err, files) {
        if (err) return done(err);
        expect(files).to.eql(['blah.txt']);
        done();
      });
  });
  
  it('should remove files', function(done) {
    git.init()
      .addFile('blah.txt', 'hello there')
      .commit({author: 'Foo <foo@foo.org>', message: 'origination.'})
      .rm('blah.txt')
      .commit({
        author: 'Foo <foo@foo.org>',
        message: 'removed blah.'
      }, function(err) {
        expect(fs.existsSync(git.abspath('blah.txt'))).to.be(false);
        done(err);
      });
  });
  
  it('should rollback uncommitted changes', function(done) {
    git.init()
      .addFile('blah.txt', 'hello there')
      .commit({
        author: 'Foo <foo@foo.org>',
        message: 'origination.'
      }, function(err) {
        if (err) return done(err);
        fs.writeFileSync(git.abspath('blah.txt'), 'changes here!');
        git.reset(function(err) {
          if (err) return done(err);
          expect(contentsOf('blah.txt')).to.be('hello there');
          done();
        });
      })
  });
  
  it('should get rid of untracked files', function(done) {
    git.init(function(err) {
      if (err) return done(err);
      fs.writeFileSync(git.abspath('blah.txt'), 'sup');
      git.reset(function(err) {
        if (err) return done(err);
        expect(fs.existsSync(git.abspath('blah.txt'))).to.be(false);
        done();
      });
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
