module.exports = function CommandSerializer() {
  var inCmd = false,
      cmdQueue = [];

  function executeNextCmd() {
    if (inCmd !== true)
      throw new Error("assertion failure, inCmd must be true");
    if (cmdQueue.length) {
      var cmd = cmdQueue.shift();
      cmd.func.apply(cmd.self, cmd.args);
    } else
      inCmd = false;
  }
  
  function queueCmd(func, self, args) {
    cmdQueue.push({func: func, self: self, args: args});
    if (!inCmd) {
      inCmd = true;
      process.nextTick(executeNextCmd);
    }
  }
  
  function makeSerializedCmd(func) {
    return function() {
      var self = this,
          args = [];
          
      for (var i = 0; i < arguments.length; i++)
        args.push(arguments[i]);
      var cb = args[args.length-1];

      function cbWrapper(err, result) {
        process.nextTick(executeNextCmd);
        if (typeof(cb) == 'function')
          cb.call(self, err, result);
      };

      if (typeof(cb) == 'function')
        args[args.length-1] = cbWrapper;
      else
        args.push(cbWrapper);

      queueCmd(func, self, args);
      return self;
    };
  }
  
  return {
    queue: cmdQueue,
    serialized: makeSerializedCmd
  };
};
