var async = require("async");
var path = require("path");
var bind_context = require(path.resolve("app/helpers/bind_context"));

var ActiveGeneratorChecker = function(client) {
  this._client = client;
};

/*
 * Если counter и generator_id остались прежними, то возвращаем true.
 * Если counter изменился, то это значит, что generator все еще работает. Возвращаем false.
 * Если counter остался прежним, а generator_id изменился, это значит, что
 * предыдущий generator завершил свою работу по каким-то причинам, при этом counter нового
 * generator-а равен counter-у старого (это совпадения). Возвращаем false.
 */

/*
 * If generator works, pass true to callback, in other case pass false
 */
ActiveGeneratorChecker.prototype.check_status = function(callback) {
  var self = this;
  async.waterfall([
    function(next) {
      self._client.get("generator_id", next);
    }, function(generator_id, next) {
      // new generator_id is invalid or expired
      next(null, typeof generator_id == "string");
    }
  ], callback);
};

ActiveGeneratorChecker.prototype.monitor_status = function(callback) {
  async.during(
    bind_context(this.check_status, this),
    function(next) {
      setTimeout(next, 500);
    }, callback);
};

module.exports = ActiveGeneratorChecker;
