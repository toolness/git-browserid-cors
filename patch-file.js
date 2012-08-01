var fs = require('fs'),
    DMP = require('./diff_match_patch_uncompressed');

exports.makePatch = function(text1, text2) {
  var dmp = new DMP.diff_match_patch();
  var diff = dmp.diff_main(text1, text2, true);
  var patchList = dmp.patch_make(text1, text2, diff);
  return dmp.patch_toText(patchList);
};

exports.patchText = function(text, patch, cb) {
  var dmp = new DMP.diff_match_patch();
  
  try {
    var patches = dmp.patch_fromText(patch);
  } catch (e) {
    return cb(e);
  }

  var results = dmp.patch_apply(patches, text);
  var failed = results[1].filter(function(val) { return !val; });
  if (failed.length)
    return cb(new Error('Unable to apply ' + failed.length + ' of ' +
                        results[1].length + ' hunk(s)'));
  cb(null, results[0]);
};

exports.patchFile = function(filename, patch, cb) {
  fs.readFile(filename, function(err, text) {
    if (err) return cb(err);
    exports.patchText(text, patch, function(err, newText) {
      if (err) return cb(err);
      fs.writeFile(filename, newText, cb);
    });
  });
};
