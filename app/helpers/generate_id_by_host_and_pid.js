var os = require("os");
var _ = require("underscore");

/*
 * PID - provides uniqueness per application.
 * If we run few applications on one host, it will be unique for each application
 * IP - provides uniqueness per host.
 * Applications from various hosts will be have different value.
 */

module.exports = function() {
  var network_interfaces = os.networkInterfaces();
  //if lo is only interface, then we work on one host, and can identificate applications only by PID
  delete network_interfaces.lo;
  var external_address;
  _(network_interfaces).find(function(interface) {
    var address = _(interface).find(function(_address) {
      return _address.internal === false;
    });
    if(address) {
      external_address = address;
      return true;
    } else {
      return false;
    }
  });

  external_address = external_address || '127.0.0.1';
  return external_address + '@' + process.pid;
}
