var expect = require('expect.js'),
    fs = require('fs'),
    utils = require('./utils')
    Git = require('../git'),
    SimpleGitServer = require('../git-server').SimpleGitServer,
    MultiGitServer = require('../git-server').MultiGitServer
    BrowserIDCORS = require('browserid-cors'),
    request = require('supertest');

describe("SimpleGitServer integration", function() {
  var testDir = utils.TestDir('../_simplegit-test', beforeEach, afterEach);
  
  it('should work', function(done) {
    var git = Git({rootDir: testDir.path()});
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
        expect(testDir.contentsOf('foo.txt')).to.be('blarg');
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

describe("MultiGitServer integration", function() {
  var testDir = utils.TestDir('../_multigit-test', beforeEach, afterEach);
  
  it('should work', function(done) {
    var gitManager = require('../git-manager')(testDir.path());
    var otherGit = Git({rootDir: testDir.path('otherrepo')});
    var app = MultiGitServer({gitManager: gitManager});
    
    app.browserIDCORS.tokenStorage.setTestingToken('abcd', {
      email: 'foo@foo.org',
      origin: 'http://bar.org'
    });
    
    fs.mkdirSync(otherGit.abspath());
    otherGit.init()
      .addFile('blah.txt', 'hello there')
      .commit({author: 'Foo <foo@foo.org>', message: 'origination.'})
      .end(function(err) {
        if (err) return done(err);
        request(app)
          .post('/otherrepo/commit')
          .set('X-Access-Token', 'abcd')
          .send({
            add: {
              'foo.txt': 'blarg'
            }
          })
          .expect(200, function(err) {
            if (err) return done(err);
            otherGit.listFiles(function(err, list) {
              if (err) return done(err);
              expect(list).to.eql(['blah.txt', 'foo.txt']);
              createRepoAndMakeFirstCommit();
            });
          });
      });

    function createRepoAndMakeFirstCommit() {
      request(app)
        .post('/somerepo/commit')
        .set('X-Access-Token', 'abcd')
        .send({
          add: {
            'foo.txt': 'blarg'
          }
        })
        .expect(200, function(err) {
          if (err) return done(err);
          expect(fs.existsSync(gitManager.rootDir + '/somerepo/.git'))
            .to.be(true);
          var contents = fs.readFileSync(gitManager.rootDir +
                                         '/somerepo/foo.txt', 'utf8');
          expect(contents).to.be('blarg');
          makeSecondCommit();
        });
    }
      
    function makeSecondCommit() {
      request(app)
        .post('/somerepo/commit')
        .set('X-Access-Token', 'abcd')
        .send({
          add: {
            'foo.txt': 'blarg2'
          }
        })
        .expect(200, function(err) {
          if (err) return done(err);
          var contents = fs.readFileSync(gitManager.rootDir +
                                         '/somerepo/foo.txt', 'utf8');
          expect(contents).to.be('blarg2');
          requestListing();
        });
    }
    
    function requestListing() {
      request(app)
        .get('/somerepo/ls')
        .send()
        .expect(200, {files: ['foo.txt']}, requestListingOfNonexistentRepo);
    }
    
    function requestListingOfNonexistentRepo(err) {
      if (err) return done(err);
      request(app)
        .get('/nonexistentrepo/ls')
        .send()
        .expect(404, getStaticFile);
    }
    
    function getStaticFile(err) {
      if (err) return done(err);
      request(app)
        .get('/static/somerepo/foo.txt')
        .send()
        .expect(200, 'blarg2', getNonexistentStaticFile);
    }
    
    function getNonexistentStaticFile(err) {
      if (err) return done(err);
      request(app)
        .get('/static/somerepo/pwaeognpoawegnpnoagwe')
        .send()
        .expect(404, done);
    }
  });
});

describe("SimpleGitServer", function() {
  function cfg(app) {
    app.browserIDCORS.tokenStorage.setTestingToken('abcd', {
      email: 'foo@foo.org',
      origin: 'http://bar.org'
    });
    return app;
  }
  
  function mockLoggingGit() {
    return {
      log: [],
      lastCommitOptions: null,
      abspath: function() { return '/blah'; },
      addFile: function(f, c) { this.log.push(['add', f, c]); },
      patchFile: function(f, p) { this.log.push(['patch', f, p]); },
      rm: function(f) { this.log.push(['rm', f]); },
      commit: function(options) {
        this.lastCommitOptions = options;
        this.log.push(['commit']);
      },
      end: function(cb) {
        cb(null);
      }
    };
  }
  
  it("should reject unauthenticated commits", function(done) {
    request(cfg(SimpleGitServer({git: {}})))
      .post('/commit')
      .expect(403, done);
  });

  it("should reject empty commits", function(done) {
    request(cfg(SimpleGitServer({git: {}})))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({message: 'lol'})
      .expect('cannot make an empty commit')
      .expect(400, done);
  });
  
  it("should reject commits with invalid filenames", function(done) {
    request(cfg(SimpleGitServer({
      git: {
        abspath: function(path) {
          if (!path)
            return "/blah";
          else
            return null;
        }
      }
    })))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({remove: ['../meh']})
      .expect(400, 'invalid filenames: ../meh', done);
  });
  
  it("should reject commits that add+remove the same file", function(done) {
    request(cfg(SimpleGitServer({git: {}})))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({
        add: {
          'foo': 'blarg'
        },
        remove: ['foo']
      })
      .expect('cannot add and remove same files')
      .expect(400, done);
  });

  it("should log explicit commit messages", function(done) {
    var git = mockLoggingGit();
    request(cfg(SimpleGitServer({git: git})))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({remove: ['foo'], message: 'removed foo'})
      .expect(200, function(err) {
        expect(git.lastCommitOptions).to.eql({
          author: 'foo <foo@foo.org>',
          message: 'removed foo\n\nThis commit was made from http://bar.org.'
        });
        done(err);
      });
  });
  
  it("should log default commit messages", function(done) {
    var git = mockLoggingGit();
    request(cfg(SimpleGitServer({git: git})))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({remove: ['foo']})
      .expect(200, function(err) {
        expect(git.lastCommitOptions).to.eql({
          author: 'foo <foo@foo.org>',
          message: 'This commit was made from http://bar.org.'
        });
        done(err);
      });
  });
  
  it("should allow commits that add files", function(done) {
    var git = mockLoggingGit();
    request(cfg(SimpleGitServer({git: git})))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({
        add: {
          'foo': 'blarg',
          'bar': 'narg'
        }
      })
      .expect(200, function(err) {
        expect(git.log).to.eql([
          ['add', 'foo', 'blarg'],
          ['add', 'bar', 'narg'],
          ['commit']
        ]);
        done(err);
      });
  });

  it("should allow commits that patch files", function(done) {
    var git = mockLoggingGit();
    request(cfg(SimpleGitServer({git: git})))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({
        add: {
          'hi.txt': {
            type: 'patch',
            data: 'i am a patch!'
          }
        }
      })
      .expect(200, function(err) {
        expect(git.log).to.eql([['patch', 'hi.txt', 'i am a patch!'],
                                ['commit']]);
        done(err);
      });
  });
  
  it("should allow commits that add files in base64", function(done) {
    var git = mockLoggingGit();
    request(cfg(SimpleGitServer({git: git})))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({
        add: {
          'hi.txt': {
            encoding: 'base64',
            data: 'SGVsbG8gV29ybGQ='
          }
        }
      })
      .expect(200, function(err) {
        var addcmd = git.log[0];
        expect(addcmd.slice(0,2)).to.eql(['add', 'hi.txt']);
        expect(addcmd[2]).to.be.a(Buffer);
        done(err);
      });
  });

  it("should allow commits that remove files", function(done) {
    var git = mockLoggingGit();
    request(cfg(SimpleGitServer({git: git})))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({
        remove: ['meh', 'beh']
      })
      .expect(200, function(err) {
        expect(git.log).to.eql([
          ['rm', 'meh'],
          ['rm', 'beh'],
          ['commit']
        ]);
        done(err);
      });
  });
  
  it("should allow commits that add+remove files", function(done) {
    var git = mockLoggingGit();
    request(cfg(SimpleGitServer({git: git})))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({
        add: {
          'foo': 'blarg'
        },
        remove: ['meh']
      })
      .expect(200, function(err) {
        expect(git.log).to.eql([
          ['add', 'foo', 'blarg'],
          ['rm', 'meh'],
          ['commit']
        ]);
        done(err);
      });
  });
  
  it("should return 500 for unknown git errors on commit", function(done) {
    request(cfg(SimpleGitServer({
      git: {
        abspath: function() { return '/blah'; },
        rm: function() {},
        commit: function() {},
        end: function(cb) { cb("uhoh"); }
      }
    })))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({remove: ['meh']})
      .expect(500, 'an unknown error occurred', done);
  });

  it("should return 200 when commit results in no change", function(done) {
    request(cfg(SimpleGitServer({
      git: {
        abspath: function() { return '/blah'; },
        rm: function() {},
        commit: function() {},
        end: function(cb) {
          cb({
            stderr: '',
            stdout: '# On branch master\nnothing to commit (working directory clean)\n',
            exitCode: 1
          });
        }
      }
    })))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({remove: ['meh']})
      .expect(409, {
        error: '# On branch master\nnothing to commit (working directory clean)\n'
      }, done);
  });

  it("should return 409 w/ info for known git errors", function(done) {
    request(cfg(SimpleGitServer({
      git: {
        abspath: function() { return '/blah'; },
        rm: function() {},
        commit: function() {},
        end: function(cb) { cb({stderr: "meh does not exist"}); }
      }
    })))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({remove: ['meh']})
      .expect(409, {error: 'meh does not exist'}, done);
  });

  it("should return 500 for unknown git errors on list", function(done) {
    request(cfg(SimpleGitServer({
      git: {
        listFiles: function(name, cb) {
          expect(name).to.be('');
          cb("uhoh");
        }
      }
    })))
      .get('/ls')
      .send()
      .expect(500, 'an unknown error occurred', done);
  });
  
  it("should list files", function(done) {
    request(cfg(SimpleGitServer({
      git: {
        listFiles: function(name, cb) {
          expect(name).to.be('bloop');
          cb(null, ['bloop/bap.js']);
        }
      }
    })))
      .get('/ls?dirname=bloop')
      .send()
      .expect(200, {files: ['bloop/bap.js']}, done);
  });
  
  it("should fail when pulling w/ no repository", function(done) {
    request(cfg(SimpleGitServer({git: {}})))
      .post('/pull')
      .set('X-Access-Token', 'abcd')
      .send()
      .expect(400, "repository expected", done);
  });

  it("should fail when pulling w/ invalid repository", function(done) {
    request(cfg(SimpleGitServer({git: {}})))
      .post('/pull')
      .set('X-Access-Token', 'abcd')
      .send({repository: 'lol'})
      .expect(400, "invalid repository", done);
  });

  it("should fail when pulling w/ no refspec", function(done) {
    request(cfg(SimpleGitServer({git: {}})))
      .post('/pull')
      .set('X-Access-Token', 'abcd')
      .send({repository: 'http://blah.org/myrepo'})
      .expect(400, "refspec expected", done);
  });

  it("should fail when pulling w/ no token", function(done) {
    request(cfg(SimpleGitServer({git: {}})))
      .post('/pull')
      .send()
      .expect(403, done);
  });

  it("should return 500 on pull failure", function(done) {
    request(cfg(SimpleGitServer({
      git: {
        pull: function(options, cb) {
          cb('fail fail fail!');
        }
      }
    })))
      .post('/pull')
      .set('X-Access-Token', 'abcd')
      .send({
        repository: 'http://blah.org/myrepo',
        refspec: 'master'
      })
      .expect(500, 'an unknown error occurred', done);
  });

  it("should pull", function(done) {
    var pullOptions;
    request(cfg(SimpleGitServer({
      git: {
        pull: function(options, cb) {
          pullOptions = options;
          cb(null);
        }
      }
    })))
      .post('/pull')
      .set('X-Access-Token', 'abcd')
      .send({
        repository: 'http://blah.org/myrepo',
        refspec: 'master'
      })
      .expect(200, function(err) {
        if (err) return done(err);
        expect(pullOptions).to.eql({
          repository: 'http://blah.org/myrepo',
          refspec: 'master',
          email: 'foo@foo.org',
          name: 'foo from http://bar.org'
        });
        done();
      });
  });
  
  it("should have /token endpoint", function(done) {
    request(cfg(SimpleGitServer({git: {}})))
      .post('/token')
      .set('Origin', 'http://lol.org')
      .send()
      .expect(400, 'assertion required', done);
  });
  
  it("should support CORS", function(done) {
    request(cfg(SimpleGitServer({git: {}})))
      .head('/')
      .send()
      .expect('Access-Control-Allow-Origin', '*', done);
  });
});

describe("MultiGitServer", function() {
  it("should reject illegal repository names", function(done) {
    var app = MultiGitServer({gitManager: {rootDir: '/meh'}});
    
    request(app)
      .get('/....../ls')
      .send()
      .expect(404, 'invalid repository id: ......', done);
  });
});
