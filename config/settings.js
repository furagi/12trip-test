var _ = require('underscore');
var env = process.env.NODE_ENV;
var secrets = require('./config.secure.json');
var _settings = require('./settings.json');
var local_settings = {};

try {
  local_settings = require('./local.json');
} catch (_error) {
  e = _error;
  console.log("Local config wasn't found or is invalid");
}

global.Settings = _.extend(_settings[env] || _settings["default"], local_settings);
Settings.database = secrets;
