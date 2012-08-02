var expect = require('expect.js'),
    SimpleGitServer = require('../simple-git-server'),
    BrowserIDCORS = require('browserid-cors'),
    request = require('supertest');

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
