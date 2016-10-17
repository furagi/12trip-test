var util  = require('util');
var _ = require('underscore');

var _log = {
    debug: {
        fn: console.log,
        priority: 1
    },
    info: {
        fn: console.log,
        priority: 2
    },
    warn: {
        fn: console.warn,
        priority: 3
    },
    error: {
        fn: console.error,
        priority: 4
    }
};

var project, priority;

// A lot of woodoo magic
var get_stack = function() {
    var orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function(_, stack) {
        return stack;
    };
    var err = new Error();
    Error.captureStackTrace(err, arguments.callee);
    var stack = err.stack;
    Error.prepareStackTrace = orig;
    delete err;
    return stack;
};

var log = function(level, message, log_object) {
    if(_log[level] && _log[level].priority < priority) {
        return;
    }
    var format_args = [message];
    for (var i = 2; i < arguments.length; ++i) {
        if(!(arguments[i] === null || arguments[i] === undefined)) {
            arg = arguments[i];
            try {
                arg = JSON.stringify(arg);
            } catch (e) {}
            format_args.push(arg);
        }
    }
    message = util.format.apply(null, format_args).trim();
    var date = new Date().toLocaleString();
    var line = get_stack()[1].getLineNumber();
    var func = get_stack()[1].getFunctionName();
    var file = get_stack()[1].getFileName().split('/');
    file = file[file.length - 1];
    if(!_log[level]) {
        console.error('%s [%s] (%s%s:%s): %s', date, 'error', project, file, line, "Log level '" + level + "' doesn't exists");
        level = 'info';
    }

    _log[level].fn('%s [%s] (%s%s:%s): %s', date, level,  project, file, line, message);
};

GlobalLogger = (function() {
    function GlobalLogger(log_level, _project) {
        if(_project) {
            project = _project + '/';
        } else {
            project = '';
        }
        switch(log_level) {
            case "error": priority = 4; break;
            case "warn": priority = 3; break;
            case "debug": priority = 1; break;
            default: priority = 2;
        }
        var self = this;
        _.each(['debug', 'info', 'warn', 'error'], function(level) {
            self[level] = function(message, log_object) {
                self.log(level, message, log_object);
            };
        });
    }

    GlobalLogger.prototype.log = log;

    return GlobalLogger;

})();

module.exports = GlobalLogger;
