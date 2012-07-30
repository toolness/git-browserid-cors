var _ = require('underscore');

module.exports = function SimpleGitServer(git) {
  var self = {};
  
  self.handleCommit = function(req, res) {
    if (!req.user)
      return res.send(403);
    
    if (!req.body.add)
      req.body.add = {};
    if (!req.body.remove)
      req.body.remove = [];
    
    var filesToAdd = Object.keys(req.body.add);
    var filesToRemove = req.body.remove;
    if (_.intersection(filesToAdd, filesToRemove).length)
      return res.send('cannot add and remove same files', 400);

    filesToAdd.forEach(function(filename) {
      git.addFile(filename, req.body.add[filename]);
    });
    filesToRemove.forEach(function(filename) {
      git.rm(filename);
    });
    git.commit(function(err) {
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
  
  self.handleList = function(req, res) {
    git.listFiles(req.param('dirname', ''), function(err, list) {
      if (err) return res.send('an unknown error occurred', 500);
      res.send({files: list}, 200);
    });
  };
  
  return self;
};
