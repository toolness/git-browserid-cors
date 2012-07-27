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
  
  function queueCmd(func, self, args, addToFront) {
    var cmd = {func: func, self: self, args: args};
    if (addToFront)
      cmdQueue.splice(0, 0, cmd);
    else
      cmdQueue.push(cmd);
    if (!inCmd) {
      inCmd = true;
      process.nextTick(executeNextCmd);
    }
  }
  
  function makeSerializedCmd(func, isImmediate) {
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

      queueCmd(func, self, args, isImmediate);
      return self;
    };
  }
  
  return {
    queue: cmdQueue,
    serialized: function(func) {
      return makeSerializedCmd(func, false);
    },
    immediate: function(func) {
      return makeSerializedCmd(func, true);
    }
  };
};
