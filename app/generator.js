var async = require("async");
var path = require("path");
var bind_context = require(path.resolve("app/helpers/bind_context"));

var Generator = function(client, generator_id) {
  this._client = client;
  this._generator_id = generator_id;
};

/*
 * Run, while this._is_generator is true, with pause = 500ms
 * Старт - проверяем, есть ли что-то в current_generator.
 * Если нет, или есть, но наше, то пишем свои значения current_generator и counter, а затем запускаем цикл генерации сообщений.
 * В противном случае запускаемся как обработчик.
 * Как только set_message в callback вернет, что мы уже не правим балом, переключаемся в режим обработчика.
 * push, wait, check
 */
Generator.prototype.start = function(callback) {
  logger.info("Generator started");
  this._is_generator = true;
  var self = this;
  async.doDuring(
    bind_context(this.iterate, this),
    bind_context(this._check_if_generator, this),
    callback
  );
};

Generator.prototype.iterate = function(callback) {
  var self = this;
  async.waterfall([
    bind_context(this._push_message, this),
    function(next) {
        setTimeout(next, 500);
    }
  ], callback);
};

/*
 * Write to this._generator = false
 */
Generator.prototype.stop = function() {
  this._is_generator = false;
};

Generator.prototype.is_generator = function() {
  return this._is_generator === true;
};

Generator.prototype._check_if_generator = function(callback) {
  /*
   * Check, if generator was stopped
   */
  if(!this.is_generator()) {
    callback(null, false);
    return;
  }
  /*
   * Check, if there isn't another generator yet
   */
  var self = this;
  this._client.get("generator_id", function(err, generator_id) {
    callback(err, !generator_id || generator_id === self._generator_id);
  });
};

/*
 * Make transaction:
 *   write to generator {generator_id: this._generator_id, counter: this._counter}
 *   push to messages new message
 */
Generator.prototype._push_message = function(callback) {
  var message = this._get_message();
  this._client.multi()
    .set("generator_id", this._generator_id)
    // set 'expire' to one second, so we have some time for network/db cost
    .expire("generator_id", 1)
    .rpush("messages", message)
    .exec(function(err, replies) {
      if(replies && typeof replies.length == "number") {
        logger.log("info", "Generator::_push_message got " + replies.length + " replies");
        replies.forEach(function (reply, index) {
          logger.log("info", "Reply " + index + ": " + reply.toString());
        });
      }
      callback(err);
    });
};

Generator.prototype._get_message = function() {
  this._counter = this._counter || 0;
  return this._counter++;
};

module.exports = Generator;
