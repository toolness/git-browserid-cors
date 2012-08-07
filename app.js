var path = require('path'),
    express = require('express'),
    config = require('./config'),
    app;

var rootDir = config.rootDir;

if (rootDir[0] != '/')
  rootDir = path.join(__dirname, rootDir);

if (config.type == "multiple") {
  var MultiGitServer = require('./git-server').MultiGitServer;
  var GitManager = require('./git-manager');
  var gitManager = GitManager({rootDir: rootDir});

  app = MultiGitServer({gitManager: gitManager});
} else {
  var SimpleGitServer = require('./git-server').SimpleGitServer;
  var Git = require('./git');
  var git = Git({rootDir: rootDir}),
  
  app = SimpleGitServer({git: git});
  config.type = "single";
}

app.use(express.logger());
app.listen(config.port, function() {
  console.log(config.type + " repo server listening on port", config.port);
});
