var spawn = require('child_process').spawn,
    path = require('path'),
    fs = require('fs'),
    CommandSerializer = require('./command-serializer');

const NO_HEAD_ERROR = "fatal: Failed to resolve 'HEAD' as a valid ref.\n";

function Git(options) {
  var executable = options.executable || 'git',
      rootDir = options.rootDir,
      debug = options.debug,
      cs = CommandSerializer(),
      self = {};

  function git(args, cb) {
    var cmdline = 'git ' + args.join(' '),
        stderr = [],
        exitCode = undefined,
        process = spawn(executable, args, {cwd: rootDir});

    if (!cb)
      throw new Error('no callback given for: ' + cmdline);

    function maybeFinish() {
      var err = null;
      if (exitCode !== undefined && typeof(stderr) == 'string') {
        if (exitCode) {
          err = new Error('subprocess failed: ' + cmdline +
                          ' with stderr: ' + JSON.stringify(stderr));
          err.stderr = stderr;
          err.exitCode = exitCode;
        }
        cb(err);
      }
    }
    
    process.stderr.setEncoding('utf8');
    process.stderr.on('data', function(chunk) { stderr.push(chunk); });
    process.stderr.on('end', function() {
      stderr = stderr.join('');
      maybeFinish();
    });
    
    process.on('exit', function(code) {
      exitCode = code;
      maybeFinish();
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
      git(['clean', '-f', '-d'], function(err) {
        if (err) return cb(err);
        git(['reset', '--hard'], function(err) {
          if (err && err.stderr == NO_HEAD_ERROR)
            err = null;
          cb(err);
        });
      });
    },
    commit: function(options, cb) {
      git([
        'commit', '--author=' + options.author,
        '-m', options.message
      ], function(err) {
        if (err) return cb(err);
        git(['update-server-info'], cb);
      });
    },
    revert: function(cb) {
      git(['revert', 'HEAD'], cb);
    },
    addFile: function(filename, data, cb) {
      var self = this;
      fs.writeFile(abspath(filename), data, function(err) {
        if (err) return cb(err);
        self.add(filename, cb);
      });
    },
    add: function(filenames, cb) {
      if (typeof(filenames) == 'string') filenames = [filenames];
      git(['add'].concat(filenames), cb);
    },
    rm: function(filenames, cb) {
      if (typeof(filenames) == 'string') filenames = [filenames];
      git(['rm', '-f', '-r'].concat(filenames), cb);
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
