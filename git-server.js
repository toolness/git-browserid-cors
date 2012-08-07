var _ = require('underscore'),
    fs = require('fs'),
    path = require('path'),
    url = require('url'),
    express = require('express');

function username(email) {
  return email.slice(0, email.indexOf('@'));
}

function namespaceCommitInfo(origInfo) {
  var id;
  var info = {};
  
  if (origInfo.message)
    info.message = origInfo.message;

  function chop(path) {
    var index = path.indexOf('/');
    if (index == -1)
      throw new Error('commit cannot contain files w/o repos');
    var root = path.slice(0, index);
    var rel = path.slice(index + 1);
    if (!root)
      throw new Error('commit cannot contain files w/o repos');
    if (!id)
      id = root;
    if (root != id)
      throw new Error("commit cannot span multiple repos: " + id +
                      ", " + root);
    return rel;
  }
  
  if (origInfo.add) {
    info.add = {};
    Object.keys(origInfo.add).forEach(function(path) {
      info.add[chop(path)] = origInfo.add[path];
    });
  }
  
  if (origInfo.remove) {
    info.remove = [];
    origInfo.remove.forEach(function(path) {
      info.remove.push(chop(path));
    });
  }
  
  if (!id)
    throw new Error('cannot make an empty commit');

  return {
    id: id,
    info: info
  };
}

var Handlers = {
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

exports.namespaceCommitInfo = namespaceCommitInfo;

exports.MultiGitServer = function MultiGitServer(config) {
  var gitManager = config.gitManager;
  var handlers = config.handlers || Handlers;
  var self = BaseServer(config.browserIDCORS);

  function validId(req, res, next) {
    var id = req.param('id');
    if (!id.match(/[A-Za-z0-9_\-]+/))
      return res.send('invalid repository id: ' + id, 404);
    next();
  }
  
  function createGitFromId(req, res, next) {
    if (!req.user)
      return res.send(403);

    gitManager.get(req.param('id'), true, function(err, git) {
      if (err)
        return res.send(500);
      req.git = git;
      next();
    });
  }
  
  function gitFromId(req, res, next) {
    gitManager.get(req.param('id'), false, function(err, git) {
      if (err) {
        if (err.code == "ENOENT")
          return res.send(404);
        return res.send(500);
      }
      req.git = git;
      next();
    });
  }
  
  if (!fs.existsSync(gitManager.rootDir))
    throw new Error("root dir does not exist: " + gitManager.rootDir);
    
  self.use('/static', express.static(gitManager.rootDir));
  self.post('/:id/commit', validId, createGitFromId, handlers.commit);
  self.post('/commit', function(req, res, next) {
    try {
      var result = namespaceCommitInfo(req.body);
    } catch (e) {
      return res.send(e.message, 400);
    }
    _.extend(req.body, result.info);
    req.params['id'] = result.id;
    next();
  }, validId, createGitFromId, handlers.commit);
  self.get('/:id/ls', validId, gitFromId, handlers.list);
  self.post('/:id/pull', validId, createGitFromId, handlers.pull);
  return self;
};

exports.SimpleGitServer = function SimpleGitServer(config) {
  var git = config.git;
  var handlers = config.handlers || Handlers;
  var self = BaseServer(config.browserIDCORS);
  
  self.use(function(req, res, next) { req.git = git; next(); });
  self.post('/commit', handlers.commit);
  self.get('/ls', handlers.list);
  self.post('/pull', handlers.pull);

  if (git.abspath)
    self.use('/static', express.static(git.abspath()));

  return self;
};
