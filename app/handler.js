var async = require("async");
var path = require("path");
var bind_context = require(path.resolve("app/helpers/bind_context"));

var Handler = function(client) {
  this._client = client;
};

/*
 * При запуске как обработчика:
 * Безостановочно извлекаем из messages сообщения (spop).
 * Каждые 1000ms проверяем, изменились ли counter и generator_id.
 * Если counter и generator_id остались прежними, то завершаем свою работу в качестве handler-а.
 * Если counter изменился, то это значит, что generator все еще работает.
 * Если counter остался прежним, а generator_id изменился, это значит, что
 * предыдущий generator завершил свою работу по каким-то причинам, при этом counter нового
 * generator-а равен counter-у старого (это совпадения).
 */
Handler.prototype.start = function(callback) {
  this._generator_is_busy = true;
  this._pop_messages(callback);
};

Handler.prototype._pop_messages = function(callback) {
  var self = this;
  async.doWhilst(
    bind_context(this._pop_message, this),
    function() {
      return self._generator_is_busy === true;
    }, callback
  );
};

Handler.prototype._pop_message = function(callback) {
  var self = this;
  async.waterfall([
    function(next) {
      self._client.rpop("messages", next);
    }, bind_context(this._process_message, this)
  ], callback);
};

Handler.prototype._process_message = function(message, callback) {
  if(typeof message != "string") {
    callback();
    return;
  }
  var self = this;
  this._handle_event(message, function(err) {
    if(err) {
      logger.log("error", message);
      self._client.rpush("errors", message, callback);
    } else {
      callback();
    }
  });
};

Handler.prototype._handle_event = function(message, callback) {
  function on_complete() {
    var error = Math.random() > 0.85;
    callback(error, message);
  }
  setTimeout(on_complete, Math.floor(Math.random()*1000));
};

Handler.prototype.stop = function() {
  this._generator_is_busy = false;
};


module.exports = Handler;
