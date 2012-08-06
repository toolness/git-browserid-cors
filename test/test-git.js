var expect = require('expect.js'),
    fs = require('fs'),
    path = require('path'),
    exec =  require('child_process').exec,
    makePatch = require('../patch-file').makePatch,
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
  
  it('should pull', function(done) {
    var git2dir = rootDir + '/repo2';
    var git2 = Git({rootDir: git2dir});
    
    fs.mkdirSync(git2dir);
    
    git.init()
      .addFile('blah.txt', 'hello')
      .commit({author: 'Foo <foo@foo.org>', message: 'origination.'})
      .end(function(err) {
        if (err) return done(err);
      
        git2.init()
          .pull({
            repository: rootDir,
            refspec: 'master',
            email: 'blap@blap.org',
            name: 'Blap Person'
          })
          .end(function(err) {
            if (err) return done(err);
            var blahTxt = fs.readFileSync(git2.abspath('blah.txt'), 'utf8');
            var reflogPath = git2.abspath('.git/logs/HEAD')
            var reflog = fs.readFileSync(reflogPath, 'utf8');
            expect(blahTxt).to.be('hello');
            expect(reflog).to.match(/blap@blap\.org/);
            expect(reflog).to.match(/Blap Person/);
            done();
          });
      });
  });
  
  it('should accept Buffer objects to addFile()', function(done) {
    git.init()
       .addFile('blah.txt', new Buffer([1,2,3]))
       .commit({author: 'Foo <foo@foo.org>', message: 'origination.'})
       .end(function(err) {
         if (err) return done(err);
         var contents = fs.readFileSync(git.abspath('blah.txt'));
         expect(contents).to.eql(new Buffer([1,2,3]));
         done();
      });
  });
  
  it('should clean up on unexpected failure', function(done) {
    fs.writeFileSync(git.abspath('untracked.txt'), 'hello');
    git.init()
       .addFile('blah.txt', 'hello')
       .commit({author: 'Foo <foo@foo.org>', message: 'origination.'})
       .addFile('blah.txt', 'supdog')
       .add('moose.txt', function(err) {
         expect(err.stderr).to.be('fatal: pathspec \'moose.txt\' did not ' +
                                  'match any files\n');
         expect(fs.existsSync(git.abspath('untracked.txt'))).to.be(false);
         expect(contentsOf('blah.txt')).to.be('hello');
         done();
       });
  });
  
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

  it('should list files in specified dirs', function(done) {
    git.init()
      .addFile('blah.txt', 'hello there')
      .addFile('foo/blah.txt', 'hello there')
      .addFile('foo/bar/blah.txt', 'hello there')
      .commit({author: 'Foo <foo@foo.org>', message: 'origination.'})
      .listFiles('foo', function(err, files) {
        if (err) return done(err);
        expect(files).to.eql(['foo/bar/blah.txt', 'foo/blah.txt']);
        done();
      });
  });
  
  it('should create directories as needed', function(done) {
    git.init()
      .addFile('a/b/c/blah.txt', 'hello there')
      .commit({author: 'Foo <foo@foo.org>', message: 'origination.'})
      .listFiles(function(err, files) {
        if (err) return done(err);
        expect(files).to.eql(['a/b/c/blah.txt']);
        expect(fs.existsSync(git.abspath('a/b/c/blah.txt'))).to.be(true);
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
  
  it('should return null when resolving an invalid abspath', function() {
    expect(git.abspath('../blargh')).to.be(null);
    expect(git.abspath('/foo/../../blargh')).to.be(null);
  });

  it('should return a string when resolving a valid abspath', function() {
    expect(git.abspath('blargh')).to.be.a('string');
    expect(git.abspath('/usr/bin').indexOf(path.normalize(rootDir))).to.be(0);
  });
  
  it('should patch files', function(done) {
    var patch = makePatch('hwllo', 'hello');
    git.init()
      .addFile('blah.txt', 'hwllo there')
      .commit({author: 'Foo <foo@foo.org>', message: 'origination.'})
      .patchFile('blah.txt', patch)
      .commit({
        author: 'Foo <foo@foo.org>',
        message: 'typo fix.'
      }, function(err) {
        if (err) return done(err);
        expect(contentsOf('blah.txt')).to.be('hello there');
        done();
      });
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
      .addFile('/blah.txt', 'goodbye yo')
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
  
  it('should integrate with SimpleGitServer', function(done) {
    var request = require('supertest');
    var SimpleGitServer = require('../simple-git-server');
    var app = SimpleGitServer({git: git});

    git.init(function(err) {
      if (err) return done(err);

      app.browserIDCORS.tokenStorage.setTestingToken('abcd', {
        email: 'foo@foo.org',
        origin: 'http://bar.org'
      });
    
      request(app)
        .post('/commit')
        .set('X-Access-Token', 'abcd')
        .send({
          add: {
            'foo.txt': 'blarg'
          }
        })
        .expect(200, onAddFooTxt);
      
      function onAddFooTxt(err) {
        if (err) return done(err);
        expect(fs.existsSync(git.abspath('foo.txt'))).to.be(true);
        expect(contentsOf('foo.txt')).to.be('blarg');
        request(app)
          .get('/static/foo.txt')
          .send()
          .expect(200, 'blarg', onGetFooTxt);
      }

      function onGetFooTxt(err) {
        if (err) return done(err);
        request(app)
          .get('/ls')
          .send()
          .expect(200, {files: ['foo.txt']}, onListFiles)
      }
      
      function onListFiles(err) {
        if (err) return done(err);
        request(app)
          .post('/commit')
          .set('X-Access-Token', 'abcd')
          .send({remove: ['foo.txt']})
          .expect(200, onRemoveFooTxt);
      }
      
      function onRemoveFooTxt(err) {
        if (err) return done(err);
        expect(fs.existsSync(git.abspath('foo.txt'))).to.be(false);
        expect(fs.existsSync(git.abspath('.git/info/refs'))).to.be(true);
        done();
      }
    });
  });
});
