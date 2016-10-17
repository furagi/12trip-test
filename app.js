var minimist = require('minimist');
var path = require('path');
var Application = require('./config/application');

var argv = minimist(process.argv.slice(2));
// check, if application was run with getErrors argument
var get_errors;
if(argv._ && argv._.length > 0 && argv._.indexOf("getErrors") != -1) {
  get_errors = true;
} else {
  get_errors = false;
}

//get log level
var log_level = argv.l || argv.level || "info";
application = new Application(log_level);

var final = function(err) {
  if(err) {
    logger.error(err);
    process.exit(1);
  } else {
    process.exit(0);
  }
};

if(get_errors) {
  application.get_errors(final);
} else {
  application.start(final);
}
