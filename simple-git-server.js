var _ = require('underscore'),
    path = require('path'),
    url = require('url'),
    express = require('express');

function username(email) {
  return email.slice(0, email.indexOf('@'));
}

var handlers = {
  commit: function(req, res) {
    var git = req.git;

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
    if (git.cmd)
      git.cmd(['update-server-info']);
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
  },
  list: function(req, res) {
    var git = req.git;

    git.listFiles(req.param('dirname', ''), function(err, list) {
      if (err) return res.send('an unknown error occurred', 500);
      res.send({files: list}, 200);
    });
  },
  pull: function(req, res) {
    var git = req.git;

    if (!req.user)
      return res.send(403);
    
    if (!(typeof(req.body.repository) == 'string'))
      return res.send('repository expected', 400);
    var repo = url.parse(req.body.repository);
    if (!(repo.protocol == "git:" || repo.protocol == "http:" ||
          repo.protocol == "https:"))
      return res.send('invalid repository', 400);
    if (!(typeof(req.body.refspec) == 'string'))
      return res.send('refspec expected', 400);
    
    git.pull({
      repository: req.body.repository,
      refspec: req.body.refspec,
      email: req.user.email,
      name: username(req.user.email) + ' from ' + req.user.origin
    }, function(err) {
      if (err) return res.send('an unknown error occurred', 500);
      return res.send(200);
    });
  }
};

function BaseServer(browserIDCORS) {
  var bic = browserIDCORS || require('browserid-cors')();
  var self = express.createServer();
  
  self.browserIDCORS = bic;
  self.use(express.bodyParser());
  self.use(bic.accessToken);
  self.use(bic.fullCORS);
  self.use(function(req, res, next) {
    if (req.path == '/token')
      return bic.handleTokenRequest(req, res);
    return next();
  });
  
  return self;
}

module.exports = function SimpleGitServer(config) {
  var git = config.git;
  var self = BaseServer(config.browserIDCORS);
  
  self.use(function(req, res, next) { req.git = git; next(); });
  self.post('/commit', handlers.commit);
  self.get('/ls', handlers.list);
  self.post('/pull', handlers.pull);

  if (git.abspath)
    self.use('/static', express.static(git.abspath()));

  return self;
};
