var _ = require('underscore'),
    path = require('path'),
    express = require('express');

function username(email) {
  return email.slice(0, email.indexOf('@'));
}

function makeCommitHandler(git, postCommit) {
  return function(req, res) {
    if (!req.user)
      return res.send(403);
    
    if (!req.body.add)
      req.body.add = {};
    if (!req.body.remove)
      req.body.remove = [];
    
    var filesToAdd = Object.keys(req.body.add);
    var filesToRemove = req.body.remove;
    var author = username(req.user.email) + ' <' + req.user.email + '>';
    var message = 'This commit was made from ' + req.user.origin + '.';
    
    if (filesToAdd.length == 0 && filesToRemove.length == 0)
      return res.send('cannot make an empty commit', 400);

    if (_.intersection(filesToAdd, filesToRemove).length)
      return res.send('cannot add and remove same files', 400);
    if (req.body.message)
      message = req.body.message + '\n\n' + message;

    var invalidFilenames = [];
    filesToAdd.concat(filesToRemove).forEach(function(filename) {
      var abspath = git.abspath(filename);
      if (abspath === null)
        invalidFilenames.push(filename);
    });
    
    if (invalidFilenames.length)
      return res.send('invalid filenames: ' + invalidFilenames.join(), 400);
    
    filesToAdd.forEach(function(filename) {
      var content = req.body.add[filename];
      if (typeof(content) == 'object') {
        if (content.encoding == 'base64')
          content = new Buffer(content.data, 'base64');
      }
      if (content.type != 'patch')
        git.addFile(filename, content);
      else
        git.patchFile(filename, content.data);
    });
    filesToRemove.forEach(function(filename) {
      git.rm(filename);
    });
    git.commit({
      author: author,
      message: message
    });
    if (postCommit)
      postCommit(git);
    git.end(function(err) {
      if (err) {
        var message = err.stderr || err.stdout;
        if (!message)
          return res.send('an unknown error occurred', 500);
        return res.send({
          error: message
        }, 409);
      }
      res.send(200);
    });
  };
}

function makeListHandler(git) {
  return function(req, res) {
    git.listFiles(req.param('dirname', ''), function(err, list) {
      if (err) return res.send('an unknown error occurred', 500);
      res.send({files: list}, 200);
    });
  };
}

module.exports = function SimpleGitServer(config) {
  var git = config.git;
  var bic = config.browserIDCORS || require('browserid-cors')();
  var self = express.createServer();
  
  self.browserIDCORS = bic;
  self.handleList = makeListHandler(git);
  self.handleCommit = makeCommitHandler(git, function postCommit(git) {
    if (git.cmd) git.cmd(['update-server-info']);
  });

  self.use(express.bodyParser());
  self.use(bic.accessToken);
  self.use(bic.fullCORS);
  self.post('/token', bic.handleTokenRequest);
  self.post('/commit', self.handleCommit);
  self.get('/ls', self.handleList);
  
  if (git.abspath)
    self.use('/static', express.static(git.abspath()));

  return self;
};
