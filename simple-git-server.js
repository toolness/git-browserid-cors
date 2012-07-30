var _ = require('underscore'),
    express = require('express');

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
    var author = req.user.email + ' <' + req.user.email + '>';
    var message = 'This commit was made from ' + req.user.origin + '.';
    
    if (filesToAdd.length == 0 && filesToRemove.length == 0)
      return res.send('cannot make an empty commit', 400);

    if (_.intersection(filesToAdd, filesToRemove).length)
      return res.send('cannot add and remove same files', 400);
    if (req.body.message)
      message = req.body.message + '\n\n' + message;

    filesToAdd.forEach(function(filename) {
      git.addFile(filename, req.body.add[filename]);
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
        if (!err.stderr)
          return res.send('an unknown error occurred', 500);
        return res.send({
          error: err.stderr
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
  self.post('/commit', self.handleCommit);
  self.get('/ls', self.handleList);
  
  if (git.abspath)
    self.use('/static', express.static(git.abspath()));

  return self;
};
