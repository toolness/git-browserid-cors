var spawn = require('child_process').spawn,
    CommandSerializer = require('./command-serializer');

function Git(options) {
  var executable = options.executable || 'git',
      rootDir = options.rootDir,
      commands = CommandSerializer(),
      self = {};
  
  function git(args, cb) {
    var process = spawn(executable, args, {cwd: rootDir});
    process.on('exit', function(code) {
      cb(code || null);
    });
  }
  
  self.init = commands.serialized(function(cb) {
    git(['init'], cb);
  });

  return self;
}

module.exports = Git;
