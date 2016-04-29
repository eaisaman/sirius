var _ = require('underscore');
_.string = require('underscore.string');
_.mixin(_.string.exports());
var crypto = require('crypto');

var Util = function () {
    },
    util = new Util();

/**
 * @description
 *
 * @param plain
 * @param salt
 * @returns {*}
 */
Util.prototype.encrypt = function (plain, salt) {
    return crypto.createHmac('sha1', salt).update(plain).digest('hex');
};

module.exports = util;
