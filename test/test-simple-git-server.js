var expect = require('expect.js'),
    SimpleGitServer = require('../simple-git-server'),
    BrowserIDCORS = require('browserid-cors'),
    express = require('express'),
    request = require('supertest');

describe("SimpleGitServer", function() {
  function cfg(server) {
    var bic = BrowserIDCORS(),
        app = express.createServer();

    bic.tokenStorage.setTestingToken('abcd', {
      email: 'foo@foo.org',
      origin: 'http://bar.org'
    });
    app.use(express.bodyParser());
    app.use(bic.accessToken);
    app.post('/commit', server.handleCommit);
    app.get('/ls', server.handleList);
    return app;
  }
  
  function mockLoggingGit() {
    return {
      log: [],
      addFile: function(f, c) { this.log.push(['add', f, c]); },
      rm: function(f) { this.log.push(['rm', f]); },
      commit: function(cb) { this.log.push(['commit']); cb(null); }
    };
  }
  
  it("should reject unauthenticated commits", function(done) {
    request(cfg(SimpleGitServer({})))
      .post('/commit')
      .expect(403, done);
  });
  
  it("should reject commits that add+remove the same file", function(done) {
    request(cfg(SimpleGitServer({})))
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
  
  it("should allow commits that add files", function(done) {
    var git = mockLoggingGit();
    request(cfg(SimpleGitServer(git)))
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

  it("should allow commits that remove files", function(done) {
    var git = mockLoggingGit();
    request(cfg(SimpleGitServer(git)))
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
    request(cfg(SimpleGitServer(git)))
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
      rm: function() {},
      commit: function(cb) { cb("uhoh"); }
    })))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({remove: ['meh']})
      .expect(500, 'an unknown error occurred', done);
  });

  it("should return 409 w/ info for known git errors", function(done) {
    request(cfg(SimpleGitServer({
      rm: function() {},
      commit: function(cb) { cb({stderr: "meh does not exist"}); }
    })))
      .post('/commit')
      .set('X-Access-Token', 'abcd')
      .send({remove: ['meh']})
      .expect(409, {error: 'meh does not exist'}, done);
  });

  it("should return 500 for unknown git errors on list", function(done) {
    request(cfg(SimpleGitServer({
      listFiles: function(name, cb) {
        expect(name).to.be('');
        cb("uhoh");
      }
    })))
      .get('/ls')
      .send()
      .expect(500, 'an unknown error occurred', done);
  });
  
  it("should list files", function(done) {
    request(cfg(SimpleGitServer({
      listFiles: function(name, cb) {
        expect(name).to.be('bloop');
        cb(null, ['bloop/bap.js']);
      }
    })))
      .get('/ls?dirname=bloop')
      .send()
      .expect(200, {files: ['bloop/bap.js']}, done);
  });
});
