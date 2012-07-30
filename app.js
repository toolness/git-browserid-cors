var path = require('path'),
    express = require('express'),
    config = require('./config'),
    SimpleGitServer = require('./simple-git-server'),
    Git = require('./git'),
    git = Git({rootDir: path.join(__dirname, config.rootDir)}),
    app = SimpleGitServer({git: git});

app.use(express.logger());
app.listen(config.port, function() {
  console.log("server listening on port", config.port);
});
