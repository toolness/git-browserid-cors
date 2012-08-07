var fs = require('fs'),
    path = require('path'),
    exec =  require('child_process').exec;

exports.TestDir = function TestDir(rootDir, beforeEach, afterEach) {
  if (rootDir[0] != '/')
    rootDir = path.join(__dirname, rootDir);

  function nukeRootDir(cb) {
    if (fs.existsSync(rootDir))
      exec('rm -rf ' + rootDir, cb);
    else
      cb(null);
  }
  
  beforeEach(function(done) {
    nukeRootDir(function(err) {
      if (err) throw err;
      fs.mkdirSync(rootDir);
      done();
    });
  });
  
  afterEach(nukeRootDir);
  
  return {
    path: function() {
      var parts = [rootDir];
      for (var i = 0; i < arguments.length; i++)
        parts.push(arguments[i]);
      return path.join.apply(path, parts);
    },
    contentsOf: function(filename) {
      return fs.readFileSync(this.path(filename), 'utf8');
    }
  };
}
