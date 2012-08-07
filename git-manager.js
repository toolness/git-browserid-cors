var fs = require('fs'),
    path = require('path'),
    Git = require('./git'),
    CommandSerializer = require('./command-serializer');

module.exports = function GitManager(rootDir) {
  var self = {rootDir: rootDir},
      repos = {},
      cs = CommandSerializer();
  
  self.get = cs.serialized(function(id, forceCreation, cb) {
    if (id in repos)
      return cb(null, repos[id]);
    fs.exists(path.join(rootDir, id, '.git'), function(exists) {
      if (!exists) {
        if (forceCreation) {
          return fs.mkdir(path.join(rootDir, id), function(err) {
            if (err) return cb(err);
            repos[id] = Git({rootDir: path.join(rootDir, id)});
            repos[id].init(function(err) {
              if (err) return cb(err);
              cb(null, repos[id]);
            });
          });
        } else
          return cb({code: 'ENOENT'});
      }
      repos[id] = Git({rootDir: path.join(rootDir, id)});
      cb(null, repos[id]);
    });
  });
  
  return self;
};
