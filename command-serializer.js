module.exports = function CommandSerializer() {
  var inCmd = false,
      queuedErr = null,
      cmdQueue = [];

  function executeNextCmd() {
    if (inCmd !== true)
      throw new Error("assertion failure, inCmd must be true");
    if (cmdQueue.length) {
      var cmd = cmdQueue.shift();
      if (queuedErr)
        cmd.func = function() {
          var cb = arguments[arguments.length-1],
              err = queuedErr;
          queuedErr = null;
          cb(err);
        };
      cmd.func.apply(cmd.self, cmd.args);
    } else
      inCmd = false;
  }

  function makeSerializedCmd(func) {
    return function() {
      var self = this,
          args = [];
          
      for (var i = 0; i < arguments.length; i++)
        args.push(arguments[i]);
      var cb = args[args.length-1];

      if (typeof(cb) == 'function') {
        args[args.length-1] = function(err, result) {
          process.nextTick(executeNextCmd);
          cb.call(self, err, result);
        };
      } else
        args.push(function(err, result) {
          if (err)
            queuedErr = err;
          executeNextCmd();
        });
      cmdQueue.push({func: func, self: self, args: args});
      if (!inCmd) {
        inCmd = true;
        process.nextTick(executeNextCmd);
      }
      return self;
    };
  }
  
  return {
    queue: cmdQueue,
    serialized: makeSerializedCmd
  };
};
