var path = require("path");
require("./settings");
var GlobalLogger = require(path.resolve("app/helpers/log"));
var redis = require("redis");
var async = require("async");
var bind_context = require(path.resolve("app/helpers/bind_context"));
var generate_id_by_host_and_pid = require(path.resolve("app/helpers/generate_id_by_host_and_pid"));
var generate_random_id = require(path.resolve("app/helpers/generate_random_id"));
var Generator = require(path.resolve("app/generator"));
var Handler = require(path.resolve("app/handler"));
var ActiveGeneratorChecker = require(path.resolve("app/active_generator_checker"));

var Application = function(log_level){
  this._set_logger(log_level);

  /*
   * generator_id = value, that's unique for each application's example.
   * An example, md5(pid + mac address). Or just random value with collision's chance -> 0
   */
  if(Settings.generate_random_id) {
    this._generator_id = generate_random_id();
  } else {
    this._generator_id = generate_id_by_host_and_pid();
  }
};

Application.prototype._set_logger = function(log_level) {
  var _logger = new GlobalLogger(log_level, Settings.project_name);
  Object.defineProperty(global, 'logger', {
    get: function() {
      return _logger;
    }
  });
};

/*
 * Старт - проверяем, есть ли что-то в current_generator.
 * Если нет, или есть, но наше, то пишем свои значения current_generator и counter, а затем запускаем цикл генерации сообщений.
 * В противном случае запускаемся как обработчик.
 * Как только set_message в callback вернет, что мы уже не правим балом, переключаемся в режим обработчика.
 *
 * При запуске как обработчика:
 * При каждом считывании сообщения считаем, сколько прошло с последнего обновления counter.
 * Если больше, чем 500ms, то внаглую пытаемся объявить себя генератором. Свято место пусто не бывает.
 *
 * Также вместо обновления/считывания counter можно было реализовать через publish/subscribe.
 */
Application.prototype.start = function(callback) {
  var self = this;
  async.waterfall([
    bind_context(self._create_client, self),
    function(next) {
      self._generator = new Generator(self._client, self._generator_id);
      self._handler = new Handler(self._client);
      self._active_generator_checker = new ActiveGeneratorChecker(self._client);
      async.forever(bind_context(self._run_cycle, self), next);
    }
  ], callback);
};

Application.prototype._create_client = function(callback) {
  this._client = redis.createClient(Settings.database);
  var callback_was_used = false;
  this._client.on("error", function (err) {
    if(!callback_was_used) {
      callback_was_used = true;
      callback(err);
    } else {
      logger.log("error", err);
    }
  });
  this._client.on("connect", function() {
    logger.info("Connected to redis");
    if(!callback_was_used) {
      callback_was_used = true;
      callback();
    }
  });
};

/*
 * Run generator. Once generator finished to work, run handler.
 * Once handler finished to work, callback
 */
Application.prototype._run_cycle = function(callback) {
  logger.log("info", "Start cycle");
  async.waterfall([
    bind_context(this._run_generator, this),
    bind_context(this._run_handler, this)
  ], callback);
};

Application.prototype._run_generator = function(callback) {
  var self = this;
  async.waterfall([
    bind_context(self._active_generator_checker.check_status, self._active_generator_checker),
    function(other_generator_already_is_active, next) {
      if(other_generator_already_is_active) {
        next();
      } else {
        self._generator.start(next);
      }
    }
  ], callback);
};

Application.prototype._run_handler = function(callback) {
  var self = this;
  var callback_was_used = false;
  this._active_generator_checker.monitor_status(function(err) {
    if(err) {
      if(!callback_was_used) {
        callback(err);
        callback_was_used = false;
      } else {
        logger.log("error", err);
      }
    } else {
      self._handler.stop();
    }
  });
  this._handler.start(function(err) {
    if(!callback_was_used) {
      callback(err);
      callback_was_used = true;
    } else {
      if(err) {
        logger.log("error", err);
      }
    }
  });
};

Application.prototype.get_errors = function(callback) {
  var self = this;
  async.waterfall([
    bind_context(this._create_client, this),
    function(next) {
      self._client.multi()
        .lrange("errors", 0, -1, next)
        .del("errors")
        .exec();
    }
  ], function(err, errors) {
    if(errors) {
      logger.log("info", "Errors:\n" + errors.join(",\n"));
    }
    callback(err);
  });
};

module.exports = Application;
