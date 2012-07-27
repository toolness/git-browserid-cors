var CommandSerializer = require('./command-serializer');

function Git(options) {
  var executable = options.executable || 'git',
      rootDir = options.rootDir,
      commands = CommandSerializer(),
      self = {};
  
  self.init = commands.serialized(function() {
    
  });

  return self;
}
