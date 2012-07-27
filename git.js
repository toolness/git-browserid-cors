var spawn = require('child_process').spawn,
    path = require('path'),
    fs = require('fs'),
    CommandSerializer = require('./command-serializer');

function Git(options) {
  var executable = options.executable || 'git',
      rootDir = options.rootDir,
      debug = options.debug,
      cs = CommandSerializer(),
      self = {};
  
  function git(args, cb) {
    var cmdline = 'git ' + args.join(' ');
    if (!cb)
      throw new Error('no callback given for: ' + cmdline);
    var process = spawn(executable, args, {cwd: rootDir});
    process.stderr.setEncoding('utf8');
    
    if (debug)
      process.stderr.on('data', function(chunk) {
        console.warn(cmdline + ': ' + chunk);
      });
    
    process.on('exit', function(code) {
      cb(code ? 'subprocess failed: ' + cmdline : null);
    });
  }
  
  var abspath = self.abspath = function abspath(filename) {
    return path.join(rootDir, filename);
  }
  
  var commands = {
    init: function(cb) {
      git(['init'], cb);
    },
    reset: function(cb) {
      git(['reset', '--hard'], cb);
    },
    commit: function(options, cb) {
      git(['commit', '--author=' + options.author,
           '-m', options.message], cb);
    },
    revert: function(cb) {
      git(['revert', 'HEAD'], cb);
    },
    addFile: function(filename, data, cb) {
      var self = this;
      fs.writeFile(abspath(filename), data, function(err) {
        if (err) return cb(err);
        self.add([filename], cb);
      });
    },
    add: function(filenames, cb) {
      git(['add'].concat(filenames), cb);
    },
    rm: function(filenames, cb) {
      git(['rm', '-f'].concat(filenames), cb);
    }
  };
  
  Object.keys(commands).forEach(function(name) {
    self[name] = cs.serialized(function() {
      return commands[name].apply(commands, arguments);
    });
  });

  return self;
}

module.exports = Git;
