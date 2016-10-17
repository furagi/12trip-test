module.exports = function(func, context) {
  return function() {
    func.apply(context, arguments);
  };
};
