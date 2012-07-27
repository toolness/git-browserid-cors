var expect = require('expect.js'),
    fs = require('fs'),
    exec =  require('child_process').exec,
    Git = require('../git');

describe('Git', function() {
  it('.init() should work', function(done) {
    var rootDir = __dirname + '/../_testrepo',
        git = Git({rootDir: rootDir});

    function go() {
      fs.mkdirSync(rootDir);
      git.init(function(err) {
        expect(err).to.be(null);
        expect(fs.existsSync(rootDir + '/.git')).to.be(true);
        done();
      });
    }
    
    if (fs.existsSync(rootDir))
      exec('rm -rf ' + rootDir, function(err) {
        if (err) throw err;
        go();
      });
    else
      go();
  });
});
