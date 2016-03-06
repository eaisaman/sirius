var _ = require('underscore');
var async = require('async');
_.string = require('underscore.string');
_.mixin(_.string.exports());
var logger = require('pomelo-logger').getLogger('chatHandler', __filename);

module.exports = function (app) {
    return new Handler(app);
};

function arrayPick(objects) {
    var keys = Array.prototype.concat.apply(Array.prototype, Array.prototype.slice.call(arguments, 1)),
        arr = [];

    objects && objects.forEach(function (obj) {
        arr.push(_.pick(obj, keys));
    });

    return arr;
};


var Handler = function (app) {
    var self = this;

    self.app = app;
    self.channelService = app.get('channelService');

    self.getChatCreator = function (chatId) {
        var channel = self.channelService.getChannel(chatId, false);
        var creatorRecord = _.where(_.values(channel.records), {category: self.app.get("creatorCategory")})[0];
        return creatorRecord.uid;
    }

    self.getChatState = function (chatId) {
        var channel = self.channelService.getChannel(chatId, false);
        var creatorRecord = _.where(_.values(channel.records), {category: self.app.get("creatorCategory")})[0];
        return creatorRecord && creatorRecord.chatState || self.app.get("chatOpenState");
    }

    self.getTopicState = function (chatId, topicId) {
        var channel = self.channelService.getChannel(chatId, false);

        if (channel) {
            var record = channel.getMember(topicId);

            if (record && record.memberType === self.app.get("topicMemberType")) {
                return record.topicState;
            }
        }

        return self.app.get("topicDestroyState");
    }

    self.getClientIds = function (channelId, userId) {
        var channel = self.channelService.getChannel(channelId, false);

        if (channel) {
            if (userId) {
                var arr = arrayPick(_.where(_.values(channel.records), {memberType: this.app.get("userMemberType")}), "uid", "sid");

                if (typeof userId === "string") {
                    var ret = [];
                    arr.every(function (item) {
                        if (item.uid === userId) {
                            ret.push(item);
                            return false;
                        }

                        return true;
                    });

                    return ret;
                } else if (toString.call(userId) === "[object Array]") {
                    var ret = [],
                        userIdArr = userId.slice(0);

                    arr.every(function (item) {
                        var index;
                        if (!userIdArr.every(function (userId, i) {
                                if (item.uid === userId) {
                                    index = i;
                                    return false;
                                }
                            })) {
                            ret.push(item);
                            userIdArr.splice(index, 1);
                        }

                        return userIdArr.length;
                    });

                    return ret;
                }
            } else if (userId === undefined) {
                return arrayPick(_.where(_.values(channel.records), {memberType: this.app.get("userMemberType")}), "uid", "sid");
            }
        }

        return [];
    }

    self.getOtherClientIds = function (channelId, userId) {
        var channel = self.channelService.getChannel(channelId, false);

        if (channel) {
            var arr = arrayPick(_.where(_.values(channel.records), {memberType: this.app.get("userMemberType")}), "uid", "sid");

            if (typeof userId === "string") {
                return _.reject(arr, function (item) {
                    return item.uid === userId;
                });
            } else if (toString.call(userId) === "[object Array]") {
                return _.reject(arr, function (item) {
                    return !userId.every(function (uid) {
                        return item.uid !== uid;
                    });
                });
            }
        } else {
            return [];
        }
    }

    self.parseJSON = function (str) {
        if (typeof str === "string") {
            if (str === "undefined" || str === "null") {
                return null;
            } else {
                try {
                    str = JSON.parse(str);
                } catch (err) {
                    logger.error(err);
                }

                return str;
            }
        } else {
            return str;
        }
    }

    self.isMemberOf = function (chatId, userId) {
        var channel = self.channelService.getChannel(chatId, false);

        return channel && channel.getMember(userId);
    }

    self.clearOldSession = function (userId, session, cb) {
        var arr = [],
            sessionService = self.app.get('sessionService'), oldSessions = sessionService.getByUid(userId);

        if (oldSessions && oldSessions.length) {
            oldSessions.forEach(function (oldSession) {
                if (session == null || oldSession.id !== session.id) {
                    arr.push(function (next) {
                        sessionService.kickBySessionId(oldSession.id, "Cannot log on multiple devices.", function (err) {
                            err && logger.error(err);
                            next(err);
                        });
                    });
                }
            });
        }

        if (arr.length) {
            async.parallel(arr, function (err) {
                if (cb) cb(err);
            });
        } else {
            if (cb) {
                process.nextTick(function () {
                    cb();
                });
            }
        }
    }

    self.findTopicOwner = function (chatId, topicId) {
        var channel = self.channelService.getChannel(chatId, false),
            ret;

        if (channel) {
            var record = channel.getMember(topicId);
            if (record.memberType === self.app.get('topicMemberType')) {
                var creator = record.creator;
                ret = _.pick(channel.getMember(creator), "uid", "sid");
            }
        }

        return ret || {};
    }

    self.leaveChannel = function (chatId, route, userId, cb) {
        var channel;

        if (typeof chatId === "object") {
            channel = chatId;
            chatId = channel.name;
        } else if (typeof chatId === "string") {
            channel = self.channelService.getChannel(chatId, false);
        }

        if (channel) {
            var record = channel.getMember(userId);

            if (record) {
                var uids;

                if (record.category === self.app.get("creatorCategory")) {
                    uids = arrayPick(_.where(_.values(channel.records), {memberType: self.app.get("userMemberType")}), "uid", "sid");
                    uids = _.reject(uids, function (item) {
                        return item.uid === userId;
                    });
                } else {
                    channel.leave(record.uid, record.sid);
                    uids = arrayPick(_.where(_.values(channel.records), {memberType: self.app.get("userMemberType")}), "uid", "sid");
                }

                if (uids.length) {
                    self.channelService.pushMessageByUids(
                        route,
                        {
                            chatId: chatId,
                            userId: userId,
                            signal: self.app.get("chatDisconnectSignal")
                        },
                        uids,
                        cb
                    );

                    return;
                }
            }
        }

        process.nextTick(function () {
            cb(null);
        });
    }

    self.sessionCloseListener = function (route, chatId, userId, userInfo, session) {
        if (session && session.uid) {
            var channel = self.channelService.getChannel(chatId, false);

            if (channel) {
                if (userInfo != null && userInfo.category === self.app.get("guestCategory")) {
                    self.leaveChannel(channel, route, userId, function (err, failIds) {
                        if (err) {
                            logger.error(err);
                        } else {
                            failIds && failIds.length && logger.error("Publish fail id:%s", failIds.toString());
                        }
                    });
                }
            }
        }
    }
};

/**
 * New client entry.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next step callback
 * @return {Void}
 */
Handler.prototype.entry = function (msg, session, next) {
    next(null, {code: 200, msg: 'game server is ok.'});
};

/**
 * Publish route for mqtt connector.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next step callback
 * @return {Void}
 */
Handler.prototype.publish = function (msg, session, next) {
    var result = {
        topic: 'publish',
        payload: JSON.stringify({code: 200, msg: 'publish message is ok.'})
    };
    next(null, result);
};

/**
 * Subscribe route for mqtt connector.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next step callback
 * @return {Void}
 */
Handler.prototype.subscribe = function (msg, session, next) {
    var result = {
        topic: 'subscribe',
        payload: JSON.stringify({code: 200, msg: 'subscribe message is ok.'})
    };
    next(null, result);
};

/**
 * @description
 *
 * Connect to server in login channel. Connect to chat if chat id provided.
 *
 * @param msg{object} Msg contains userId, deviceId, loginChannel(optional), chatId(optional), route(optional)
 * @param session {object}
 * @param next{function} Return object contains sid.
 * @return {Void}
 */
Handler.prototype.connect = function (msg, session, next) {
    var self = this, userId = msg.userId, chatId = this.parseJSON(msg.chatId), deviceId = msg.deviceId, sid = this.app.get("serverId"), loginChannel = msg.loginChannel || this.app.get("loginChannel"), route = msg.route || this.app.get("chatRoute");
    if (userId && deviceId) {
        var channel = this.channelService.getChannel(loginChannel, true);
        if (channel) {
            var arr = [];
            arr.push(function (cb) {
                self.clearOldSession(userId, session, function () {
                    var record = channel.getMember(userId);
                    if (record && record.deviceId !== deviceId) {
                        channel.leave(record.uid, record.sid);
                        record = null;
                    }
                    if (!record) {
                        channel.add(userId, sid);
                        record = channel.getMember(userId);
                        record.deviceId = deviceId;
                        record.memberType = self.app.get("userMemberType");
                        record.category = self.app.get("guestCategory");
                    }

                    session.bind(userId, function () {
                        session.set("sid", sid);
                        session.set("deviceId", deviceId);
                        session.on("closed", self.sessionCloseListener.bind(self, route, null, userId, null));
                    });

                    cb();
                });
            });
            if (chatId) {
                if (typeof chatId === "string") {
                    arr.push(function (cb) {
                        self.connectChat(_.pick(msg, "userId", "chatId", "deviceId", "route"), session, function (err, ret) {
                            if (ret.code != 200) {
                                cb(ret.msg);
                            } else {
                                cb(null);
                            }
                        });
                    });
                }
                else if (toString.call(chatId) === "[object Array]") {
                    arr.push(function (cb) {
                        var pArr = [],
                            cMsg = _.pick(msg, "userId", "deviceId", "route");

                        chatId.forEach(function (cid) {
                            pArr.push(function (callback) {
                                self.connectChat(_.extend(_.clone(cMsg), {chatId: cid}), session, function (err, ret) {
                                    if (ret.code != 200) {
                                        callback(ret.msg);
                                    } else {
                                        callback(null);
                                    }
                                });
                            });
                        });
                        async.parallel(pArr, function (err) {
                            cb(err);
                        })
                    });
                }
            }

            async.waterfall(arr, function (err) {
                if (err) {
                    logger.error('chatHandler.connect:' + err.toString());

                    next(null, {code: 500, msg: 'chatHandler.connect:' + err.toString()});
                } else {
                    next(null, {
                        code: 200,
                        msg: {sid: sid}
                    });
                }
            })
        } else {
            next(null, {code: 500, msg: 'chatHandler.connect:Channel not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.connect:Parameter is empty.'});
    }
}

/**
 * @description
 *
 * Disconnect from server. Leave chat if chat id provided. If user is the chat creator,
 * keep his record in the chat.
 *
 * @param msg{object} Msg contains userId, loginChannel, chatId(array of chat id, optional), route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.disconnect = function (msg, session, next) {
    var self = this, userId = msg.userId, chatId = this.parseJSON(msg.chatId), loginChannel = msg.loginChannel || this.app.get("loginChannel"), route = msg.route || this.app.get("chatRoute");

    if (userId) {
        var arr = [], channel = this.channelService.getChannel(loginChannel, false);
        if (channel) {
            var record = channel.getMember(userId);
            if (record)
                channel.leave(record.uid, record.sid);
        }

        if (chatId) {
            if (typeof chatId === "string") {
                arr.push(function (callback) {
                    self.leaveChannel(chatId, route, userId, function (err, failIds) {
                        if (err) {
                            logger.error("chatHandler.disconnect:" + err.toString());
                        } else {
                            failIds && failIds.length && logger.error("chatHandler.disconnect:Publish fail id:%s", failIds.toString());
                        }

                        callback(null);
                    });
                });
            } else if (toString.call(chatId) === "[object Array]") {
                var pArr = [];
                chatId.forEach(function (cid) {
                    pArr.push(function (cb) {
                        self.leaveChannel(cid, route, userId, function (err, failIds) {
                            if (err) {
                                logger.error("chatHandler.disconnect:" + err.toString());
                            } else {
                                failIds && failIds.length && logger.error("chatHandler.disconnect:Publish fail id:%s", failIds.toString());
                            }

                            cb(null);
                        });
                    });
                });
                pArr.length && arr.push(function (callback) {
                    async.parallel(pArr, function (err) {
                        callback(err);
                    })
                });
            }
        }

        arr.push(function (callback) {
            self.clearOldSession(userId, session, function (err) {
                callback(err);
            });
        });

        async.waterfall(arr, function (err) {
            if (err) {
                logger.error('chatHandler.disconnect:' + err.toString());

                next(null, {code: 500, msg: 'chatHandler.disconnect:' + err.toString()});
            } else {
                next(null, {
                    code: 200,
                    msg: {}
                });
            }
        });
    } else {
        next(null, {code: 500, msg: 'chatHandler.disconnect:Parameter is empty.'});
    }
}

/**
 * @description
 *
 * Send friend invitation to users.
 *
 * @param msg{object} Msg contains userId, uids(array of object having uid&loginChannel), route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.invite = function (msg, session, next) {
    var self = this, userId = msg.userId, uids = this.parseJSON(msg.uids), route = msg.route || this.app.get("chatRoute");
    if (userId) {
        if (uids && uids.length) {
            var arr = [];

            uids.forEach(function (item) {
                arr.push(function (cb) {
                    var loginChannel = item.loginChannel;

                    if (loginChannel) {
                        var channel = self.channelService.getChannel(loginChannel, false);

                        if (channel) {
                            var record = channel.getMember(item.uid);

                            cb(null, record);
                        } else {
                            logger.warn('chatHandler.invite:User [%s] login channel not found.', item.uid);

                            cb(null, null);
                        }
                    } else {
                        logger.warn('chatHandler.invite:User [%s] does not have login channel.', item.uid);
                        cb(null, null);
                    }
                });
            });

            async.waterfall([
                function (callback) {
                    async.parallel(arr, function (err, records) {
                        callback(null, records);
                    });
                },
                function (records, callback) {
                    records = _.filter(records, function (item) {
                        return item;
                    });

                    if (records.length) {
                        self.channelService.pushMessageByUids(
                            route,
                            {
                                userId: userId,
                                signal: self.app.get("inviteSignal"),
                                payload: {}
                            },
                            records,
                            function (err, failIds) {
                                failIds && failIds.length && logger.error("chatHandler.invite:Publish fail id:%s", failIds.toString());

                                callback(err);
                            }
                        );
                    } else {
                        callback(null);
                    }
                }
            ], function (err) {
                if (err) {
                    logger.error('chatHandler.invite:' + err.toString());

                    next(null, {code: 500, msg: 'chatHandler.invite:' + err.toString()});
                } else {
                    next(null, {code: 200, msg: {}});
                }
            })
        } else {
            next(null, {code: 200, msg: 'chatHandler.invite:No push user found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.invite:Parameter userId is empty.'});
    }
}

/**
 * @description
 *
 * Accept friend invitation.
 *
 * @param msg{object} Msg contains userId, creatorId, creatorLoginChannel, route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.acceptInvitation = function (msg, session, next) {
    var userId = msg.userId, creatorId = msg.creatorId, creatorLoginChannel = msg.creatorLoginChannel, route = msg.route || this.app.get("chatRoute");
    if (userId && creatorId && creatorLoginChannel) {
        var channel = this.channelService.getChannel(creatorLoginChannel, false);

        if (channel) {
            var record = channel.getMember(creatorId);

            if (record) {
                this.channelService.pushMessageByUids(
                    route,
                    {
                        userId: userId,
                        signal: this.app.get("acceptSignal"),
                        payload: {}
                    },
                    [record],
                    function (err, failIds) {
                        if (err) {
                            logger.error('chatHandler.acceptInvitation:' + err.toString());

                            next(null, {code: 500, msg: 'chatHandler.acceptInvitation:' + err.toString()});
                        } else {
                            failIds && failIds.length && logger.error("chatHandler.acceptInvitation:Publish fail id:%s", failIds.toString());

                            next(null, {code: 200, msg: {}});
                        }
                    }
                );
            } else {
                next(null, {code: 200, msg: 'chatHandler.acceptInvitation:No push user found.'});
            }
        } else {
            logger.error('chatHandler.acceptInvitation:Creator[%s] login channel not found.', creatorId);

            next(null, {code: 200, msg: 'chatHandler.acceptInvitation:Creator login channel not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.acceptInvitation:Parameter is empty.'});
    }
}

/**
 * @description
 *
 * Create chat, add creator. The chat state will be saved in the record of creator. All other clients' record
 * will be cleaned if his session closed except for the creator's record. It will be populated to a new record
 * if the creator reconnects to the chat.
 *
 * @param msg{object} Msg contains userId, chatId, deviceId, route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.createChat = function (msg, session, next) {
    var self = this, userId = msg.userId, chatId = msg.chatId, deviceId = msg.deviceId, sid = this.app.get("serverId"), route = msg.route || this.app.get("chatRoute");
    if (userId && chatId && deviceId && sid) {
        var channel = this.channelService.getChannel(chatId, true),
            record = channel.getMember(userId);
        if (record) {
            channel.leave(record.uid, record.sid);
        }
        channel.add(userId, sid);
        record = channel.getMember(userId);
        record.deviceId = msg.deviceId;
        record.memberType = this.app.get("userMemberType");
        record.category = this.app.get("creatorCategory");
        record.chatState = this.app.get("chatOpenState");

        next(null, {code: 200, msg: {}});
    } else {
        next(null, {code: 500, msg: 'chatHandler.create:Parameter is empty.'});
    }
};

/**
 * @description
 *
 * Add client to channel, publish client connect signal to all other clients. The chat state will be returned too.
 * If creator reconnects, the old record will be populated to the new one.
 *
 * @param msg{object} Msg contains userId, chatId, deviceId, route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.connectChat = function (msg, session, next) {
    var self = this, userId = msg.userId, chatId = msg.chatId, deviceId = msg.deviceId, sid = this.app.get("serverId"), route = msg.route || this.app.get("chatRoute");
    if (userId && chatId && deviceId && sid) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var chatState,
                record = channel.getMember(userId),
                category = this.app.get("guestCategory"),
                memberType = this.app.get("userMemberType");
            if (record) {
                category = record.category;
                memberType = record.memberType;
                chatState = record.chatState;
                if (record.deviceId !== deviceId) {
                    channel.leave(record.uid, record.sid);
                    record = null;
                }
            }

            var uids = this.getOtherClientIds(chatId, userId);

            if (!record) {
                channel.add(userId, sid);
                record = channel.getMember(userId);
                record.deviceId = deviceId;
                record.memberType = memberType;
                record.category = category;
                if (chatState != null) record.chatState = chatState;
            }

            if (uids && uids.length) {
                self.channelService.pushMessageByUids(
                    route,
                    {
                        chatId: chatId,
                        signal: self.app.get("chatConnectSignal"),
                        userId: userId,
                        chatState: chatState
                    },
                    uids,
                    function (err, failIds) {
                        if (err) {
                            logger.error('chatHandler.connectChat:' + err.toString());

                            next(null, {code: 500, msg: 'chatHandler.connectChat:' + err.toString()});
                        } else {
                            failIds && failIds.length && logger.error("chatHandler.connectChat:Publish fail id:%s", failIds.toString());

                            next(null, {
                                code: 200,
                                msg: {}
                            });
                        }
                    }
                );
            } else {
                next(null, {code: 200, msg: {}});
            }
        } else {
            next(null, {code: 500, msg: 'chatHandler.connectChat:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.connectChat:Parameter is empty.'});
    }
};

/**
 * @description
 *
 * Leave chat. If user is the chat creator, keep his record in the chat.
 *
 * @param msg{object} Msg contains userId, chatId(array of chat id), route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.disconnectChat = function (msg, session, next) {
    var self = this, userId = msg.userId, chatId = this.parseJSON(msg.chatId), route = msg.route || this.app.get("chatRoute");

    if (userId && chatId && chatId.length) {
        var arr = [];

        if (typeof chatId === "string") {
            arr.push(function (callback) {
                self.leaveChannel(chatId, route, userId, function (err, failIds) {
                    if (err) {
                        logger.error("chatHandler.disconnectChat:" + err.toString());
                    } else {
                        failIds && failIds.length && logger.error("chatHandler.disconnectChat:Publish fail id:%s", failIds.toString());
                    }

                    callback(null);
                });
            });
        } else if (toString.call(chatId) === "[object Array]") {
            var pArr = [];
            chatId.forEach(function (cid) {
                pArr.push(function (cb) {
                    self.leaveChannel(cid, route, userId, function (err, failIds) {
                        if (err) {
                            logger.error("chatHandler.disconnectChat:" + err.toString());
                        } else {
                            failIds && failIds.length && logger.error("chatHandler.disconnectChat:Publish fail id:%s", failIds.toString());
                        }

                        cb(null);
                    });
                });
            });
            pArr.length && arr.push(function (callback) {
                async.parallel(pArr, function (err) {
                    callback(err);
                })
            });
        }

        async.waterfall(arr, function (err) {
            if (err) {
                logger.error('chatHandler.disconnectChat:' + err.toString());

                next(null, {code: 500, msg: 'chatHandler.disconnectChat:' + err.toString()});
            } else {
                next(null, {
                    code: 200,
                    msg: {}
                });
            }
        });
    } else {
        next(null, {code: 500, msg: 'chatHandler.disconnectChat:Parameter is empty.'});
    }
}

/**
 * @description
 *
 * Publish pause signal to all connected clients, only creator is allowed to.
 *
 * @param msg{object} Msg contains userId, chatId, route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.pauseChat = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, route = msg.route || this.app.get("chatRoute");
    if (userId && chatId) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var record = channel.getMember(userId);
            if (record) {
                if (record.category === this.app.get("creatorCategory")) {
                    record.chatState = this.app.get("chatPauseState");

                    var uids = this.getOtherClientIds(chatId, userId);

                    if (uids && uids.length) {
                        this.channelService.pushMessageByUids(
                            route,
                            {
                                chatId: chatId,
                                signal: this.app.get("chatPauseSignal"),
                                userId: userId,
                                chatState: this.app.get("chatPauseState")
                            },
                            uids,
                            function (err, failIds) {
                                if (err) {
                                    logger.error('chatHandler.pauseChat:' + err.toString());

                                    next(null, {code: 500, msg: 'chatHandler.pauseChat:' + err.toString()});
                                } else {
                                    failIds && failIds.length && logger.error("chatHandler.pauseChat:Publish fail id:%s", failIds.toString());

                                    next(null, {
                                        code: 200,
                                        msg: {}
                                    });
                                }
                            }
                        );
                    } else {
                        next(null, {code: 200, msg: 'chatHandler.pauseChat:No push user found.'});
                    }
                } else {
                    next(null, {code: 500, msg: 'chatHandler.pauseChat:Only chat creator is allowed to.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.pauseChat:Client not belongs to the chat.'});
            }
        } else {
            next(null, {code: 500, msg: 'chatHandler.pauseChat:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.pauseChat:Parameter userId or chatId is empty.'});
    }
};

/**
 * @description
 *
 * Publish resume signal to all connected clients, only creator is allowed to. The containing topics will be resumed as well.
 *
 * @param msg{object} Msg contains userId, chatId, route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.resumeChat = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, route = msg.route || this.app.get("chatRoute");
    if (userId && chatId) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var record = channel.getMember(userId);
            if (record) {
                if (record.category === this.app.get("creatorCategory")) {
                    record.chatState = this.app.get("chatOpenState");

                    var uids = this.getOtherClientIds(chatId, userId);

                    if (uids && uids.length) {
                        this.channelService.pushMessageByUids(
                            route,
                            {
                                chatId: chatId,
                                userId: userId,
                                signal: this.app.get("chatResumeSignal"),
                                chatState: this.app.get("chatOpenState")
                            },
                            uids,
                            function (err, failIds) {
                                if (err) {
                                    logger.error('chatHandler.resumeChat:' + err.toString());

                                    next(null, {code: 500, msg: 'chatHandler.resumeChat:' + err.toString()});
                                } else {
                                    failIds && failIds.length && logger.error("chatHandler.resumeChat:Publish fail id:%s", failIds.toString());

                                    next(null, {code: 200, msg: {}});
                                }
                            }
                        );
                    } else {
                        next(null, {code: 200, msg: 'chatHandler.resumeChat:No push user found.'});
                    }
                } else {
                    next(null, {code: 500, msg: 'chatHandler.resumeChat:Only chat creator is allowed to.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.resumeChat:Client not belongs to the chat.'});
            }
        } else {
            next(null, {code: 500, msg: 'chatHandler.resumeChat:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.resumeChat:Parameter userId or chatId is empty.'});
    }
};

/**
 * @description
 *
 * Publish chat invitation signal to all connected clients in login channel.
 *
 * @param msg{object} Msg contains userId, chatId, uids(array of object having uid&loginChannel), route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.inviteChat = function (msg, session, next) {
    var self = this, userId = msg.userId, chatId = msg.chatId, uids = this.parseJSON(msg.uids), route = msg.route || this.app.get("chatRoute");
    if (userId && chatId) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var record = channel.getMember(userId);
            if (record) {
                if (uids && uids.length) {
                    var arr = [];

                    uids.forEach(function (item) {
                        arr.push(function (cb) {
                            var loginChannel = item.loginChannel;

                            if (loginChannel) {
                                var channel = self.channelService.getChannel(loginChannel, false);

                                if (channel) {
                                    var record = channel.getMember(item.uid);

                                    cb(null, record);
                                } else {
                                    logger.warn('chatHandler.inviteChat:User [%s] login channel not found.', item.uid);

                                    cb(null, null);
                                }
                            } else {
                                logger.warn('chatHandler.inviteChat:User [%s] does not have login channel.', item.uid);
                                cb(null, null);
                            }
                        });
                    });

                    async.waterfall([
                        function (callback) {
                            async.parallel(arr, function (err, records) {
                                callback(null, records);
                            });
                        },
                        function (records, callback) {
                            records = _.filter(records, function (item) {
                                return item;
                            });

                            if (records.length) {
                                self.channelService.pushMessageByUids(
                                    route,
                                    {
                                        chatId: chatId,
                                        userId: userId,
                                        signal: self.app.get("chatInviteSignal"),
                                        chatState: self.getChatState(chatId)
                                    },
                                    records,
                                    function (err, failIds) {
                                        failIds && failIds.length && logger.error("chatHandler.inviteChat:Publish fail id:%s", failIds.toString());

                                        callback(err);
                                    }
                                );
                            } else {
                                callback(null);
                            }
                        }
                    ], function (err) {
                        if (err) {
                            logger.error('chatHandler.inviteChat:' + err.toString());

                            next(null, {code: 500, msg: 'chatHandler.inviteChat:' + err.toString()});
                        } else {
                            next(null, {code: 200, msg: {}});
                        }
                    })
                } else {
                    next(null, {code: 200, msg: 'chatHandler.inviteChat:No push user found.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.inviteChat:Client not belongs to the chat.'});
            }
        } else {
            next(null, {code: 500, msg: 'chatHandler.inviteChat:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.inviteChat:Parameter userId or chatId is empty.'});
    }
};

/**
 * @description
 *
 * Accept chat invitation.
 *
 * @param msg{object} Msg contains userId, chatId, deviceId, route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.acceptChatInvitation = function (msg, session, next) {
    var self = this, userId = msg.userId, chatId = msg.chatId, deviceId = msg.deviceId, route = msg.route || this.app.get("chatRoute");
    if (userId && chatId && deviceId) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            async.waterfall([
                function (cb) {
                    self.connectChat(_.pick(msg, "userId", "chatId", "deviceId", "route"), session, function (err, ret) {
                        if (ret.code != 200) {
                            cb(ret.msg);
                        } else {
                            cb(null);
                        }
                    });
                },
                function (cb) {
                    var uids = self.getOtherClientIds(chatId, userId);

                    if (uids && uids.length) {
                        self.channelService.pushMessageByUids(
                            route,
                            {
                                chatId: chatId,
                                userId: userId,
                                signal: self.app.get("chatAcceptSignal"),
                                chatState: self.getChatState(chatId)
                            },
                            uids,
                            function (err, failIds) {
                                cb(err);
                            }
                        );
                    } else {
                        cb(null);
                    }
                }
            ], function (err) {
                if (err) {
                    next(null, {code: 500, msg: 'chatHandler.acceptChatInvitation:' + err.toString()});
                } else {
                    next(null, {code: 200, msg: {}});
                }
            });
        } else {
            next(null, {code: 500, msg: 'chatHandler.acceptChatInvitation:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.acceptChatInvitation:Parameter userId or chatId is empty.'});
    }
}

/**
 * @description
 *
 * Destroy channel, only creator is allowed to.
 *
 * @param msg{object} Msg contains userId, chatId, route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.closeChat = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, route = msg.route || this.app.get("chatRoute");
    if (userId && chatId) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var record = channel.getMember(userId);
            if (record) {
                if (record.category === this.app.get("creatorCategory")) {
                    var uids = this.getOtherClientIds(chatId, userId);

                    this.channelService.destroyChannel(chatId);

                    if (uids && uids.length) {
                        this.channelService.pushMessageByUids(
                            route,
                            {
                                chatId: chatId,
                                userId: userId,
                                signal: this.app.get("chatCloseSignal")
                            },
                            uids,
                            function (err, failIds) {
                                if (err) {
                                    logger.error('chatHandler.closeChat:' + err.toString());

                                    next(null, {code: 500, msg: 'chatHandler.closeChat:' + err.toString()});
                                } else {
                                    failIds && failIds.length && logger.error("chatHandler.closeChat:Publish fail id:%s", failIds.toString());

                                    next(null, {code: 200, msg: 'chatHandler.closeChat:Channel destroyed.'});
                                }
                            }
                        );
                    } else {
                        next(null, {code: 200, msg: 'chatHandler.closeChat:No user found.'});
                    }
                } else {
                    next(null, {code: 500, msg: 'chatHandler.closeChat:Only creator is allowed to.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.closeChat:Client not belongs to chat.'});
            }
        } else {
            next(null, {code: 200, msg: 'chatHandler.closeChat:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.closeChat:Parameter userId or chatId is empty.'});
    }
};

/**
 * @description
 *
 * Create topic, broadcast topic to other clients in channel. Topic is a special kind of channel member.
 *
 * @param msg{object} Msg contains userId, chatId, topicId, route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.createTopic = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, topicId = msg.topicId, sid = this.app.get("serverId"), route = msg.route || this.app.get("chatRoute");
    if (userId && chatId && topicId && sid) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var record = channel.getMember(topicId);

            //TODO Record member type not check, creator not check.
            if (!record) {
                channel.add(topicId, sid);
                record = channel.getMember(topicId);
                record.memberType = this.app.get("topicMemberType");
                record.topicState = this.app.get("topicOpenState");
                record.creator = userId;
            }

            next(null, {code: 200, msg: {topicId: topicId, topicState: record.topicState}});
        } else {
            next(null, {code: 500, msg: 'chatHandler.createTopic:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'topicHandler.createTopic:Parameter is empty.'});
    }
};

/**
 * @description
 *
 * Change topic state to pause, send pause topic signal to all clients in channel. Only topic creator is allowed to.
 *
 * @param msg{object} Msg contains userId, chatId, topicId, route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.pauseTopic = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, topicId = msg.topicId, route = msg.route || this.app.get("chatRoute");
    if (userId && chatId && topicId) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var record = channel.getMember(topicId);

            if (record && record.memberType === this.app.get("topicMemberType")) {
                if (record.creator === userId) {
                    record.topicState = this.app.get("topicPauseState");

                    var uids = this.getOtherClientIds(chatId, userId);

                    if (uids && uids.length) {
                        this.channelService.pushMessageByUids(
                            route,
                            {
                                chatId: chatId,
                                userId: userId,
                                topicId: topicId,
                                signal: this.app.get("topicPauseSignal"),
                                topicState: this.app.get("topicPauseState")
                            },
                            uids,
                            function (err, failIds) {
                                if (err) {
                                    logger.error('chatHandler.pauseChatTopic:' + err.toString());

                                    next(null, {code: 500, msg: 'chatHandler.pauseChatTopic:' + err.toString()});
                                } else {
                                    failIds && failIds.length && logger.error("chatHandler.pauseChatTopic:Publish fail id:%s", failIds.toString());

                                    next(null, {code: 200, msg: {}});
                                }
                            }
                        );
                    } else {
                        next(null, {code: 200, msg: 'chatHandler.pauseChatTopic:No user found.'});
                    }
                } else {
                    next(null, {code: 500, msg: 'chatHandler.pauseChatTopic:Only topic creator is allowed.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.pauseChatTopic:Topic not found.'});
            }

        } else {
            next(null, {code: 500, msg: 'chatHandler.pauseChatTopic:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.pauseChatTopic:Parameter is empty.'});
    }
};

/**
 * @description
 *
 * Change topic state to open, send resume topic signal to all clients in channel. Only topic creator is allowed to.
 *
 * @param msg{object} Msg contains userId, chatId, topicId, route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.resumeTopic = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, topicId = msg.topicId, route = msg.route || this.app.get("chatRoute");
    if (userId && chatId && topicId) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var record = channel.getMember(topicId);

            if (record && record.memberType === this.app.get("topicMemberType")) {
                if (record.creator === userId) {
                    record.topicState = this.app.get("topicOpenState");

                    var uids = this.getOtherClientIds(chatId, userId);

                    if (uids && uids.length) {
                        this.channelService.pushMessageByUids(
                            route,
                            {
                                chatId: chatId,
                                userId: userId,
                                topicId: topicId,
                                signal: this.app.get("topicResumeSignal"),
                                topicState: this.app.get("topicOpenState")
                            },
                            uids,
                            function (err, failIds) {
                                if (err) {
                                    logger.error('chatHandler.resumeTopic:' + err.toString());

                                    next(null, {code: 500, msg: 'chatHandler.resumeTopic:' + err.toString()});
                                } else {
                                    failIds && failIds.length && logger.error("chatHandler.resumeTopic:Publish fail id:%s", failIds.toString());

                                    next(null, {code: 200, msg: {}});
                                }
                            }
                        );
                    } else {
                        next(null, {code: 200, msg: 'chatHandler.resumeTopic:No user found.'});
                    }
                } else {
                    next(null, {code: 500, msg: 'chatHandler.resumeTopic:Only topic creator is allowed.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.resumeTopic:Topic not found.'});
            }

        } else {
            next(null, {code: 500, msg: 'chatHandler.resumeTopic:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.resumeTopic:Parameter is empty.'});
    }
};

/**
 * @description
 *
 * Invite to join topic, send invite topic signal to all clients, if not specified, in channel. Only topic creator is allowed to.
 *
 * @param msg{object} Msg contains userId, chatId, topicId, uids(array of uid, optional), route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.inviteTopic = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, topicId = msg.topicId, uids = this.getClientIds(chatId, this.parseJSON(msg.uids)), route = msg.route || this.app.get("chatRoute");
    if (userId && chatId && topicId) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var record = channel.getMember(topicId);

            if (record && record.memberType === this.app.get("topicMemberType")) {
                if (record.creator === userId) {
                    if (!uids || uids.length == 0) {
                        uids = this.getOtherClientIds(chatId, userId);
                    }

                    if (uids.length) {
                        this.channelService.pushMessageByUids(
                            route,
                            {
                                chatId: chatId,
                                userId: userId,
                                topicId: topicId,
                                signal: this.app.get("topicInviteSignal"),
                                topicState: record.topicState
                            },
                            uids,
                            function (err, failIds) {
                                if (err) {
                                    logger.error('chatHandler.inviteTopic:' + err.toString());

                                    next(null, {code: 500, msg: 'chatHandler.inviteTopic:' + err.toString()});
                                } else {
                                    failIds && failIds.length && logger.error("chatHandler.inviteTopic:Publish fail id:%s", failIds.toString());

                                    next(null, {code: 200, msg: {}});
                                }
                            }
                        );
                    } else {
                        next(null, {code: 200, msg: 'chatHandler.inviteTopic:No client found.'});
                    }
                } else {
                    next(null, {code: 500, msg: 'chatHandler.inviteTopic:Only topic creator is allowed.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.inviteTopic:Topic not found.'});
            }

        } else {
            next(null, {code: 500, msg: 'chatHandler.inviteTopic:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.inviteTopic:Parameter is empty.'});
    }
};

/**
 * @description
 *
 * Close topic. Only topic creator is allowed to.
 *
 * @param msg{object} Msg contains userId, chatId, topicId, route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.closeTopic = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, topicId = msg.topicId, route = msg.route || this.app.get("chatRoute");
    if (userId && chatId && topicId) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var record = channel.getMember(topicId);

            if (record && record.memberType === this.app.get("topicMemberType")) {
                if (record.creator === userId) {
                    channel.leave(record.uid, record.sid);

                    var uids = this.getOtherClientIds(chatId, userId);
                    if (uids.length) {
                        this.channelService.pushMessageByUids(
                            route,
                            {
                                chatId: chatId,
                                userId: userId,
                                topicId: topicId,
                                signal: this.app.get("topicCloseSignal")
                            },
                            uids,
                            function (err, failIds) {
                                if (err) {
                                    logger.error('chatHandler.closeTopic:' + err.toString());

                                    next(null, {code: 500, msg: 'chatHandler.closeTopic:' + err.toString()});
                                } else {
                                    failIds && failIds.length && logger.error("chatHandler.closeTopic:Publish fail id:%s", failIds.toString());

                                    next(null, {code: 200, msg: {}});
                                }
                            }
                        );
                    } else {
                        next(null, {code: 200, msg: 'chatHandler.closeTopic:No push client exists.'});
                    }
                } else {
                    next(null, {code: 500, msg: 'chatHandler.closeTopic:Only topic creator is allowed.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.closeTopic:Topic not found.'});
            }

        } else {
            next(null, {code: 500, msg: 'chatHandler.closeTopic:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.closeTopic:Parameter is empty.'});
    }
};

/**
 * @description
 *
 * Publish message to all connected clients, if not specified, in channel.
 *
 * @param msg{object} Msg contains userId, chatId, uids(array of uid, optional), route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.push = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, uids = this.getClientIds(chatId, this.parseJSON(msg.uids)), route = msg.route || this.app.get("chatRoute");
    if (userId && chatId) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            if (this.isMemberOf(chatId, userId)) {
                if (this.getChatState(chatId) == this.app.get("chatOpenState")) {
                    if (!uids || uids.length == 0) {
                        uids = this.getOtherClientIds(chatId, userId);
                    }

                    if (uids && uids.length) {
                        this.channelService.pushMessageByUids(
                            route,
                            {
                                chatId: chatId,
                                userId: userId,
                                signal: this.app.get("chatMessageSignal"),
                                payload: msg.payload
                            },
                            uids,
                            function (err, failIds) {
                                if (err) {
                                    logger.error('chatHandler.push:' + err.toString());

                                    next(null, {code: 500, msg: 'chatHandler.push:' + err.toString()});
                                } else {
                                    failIds && failIds.length && logger.error("chatHandler.push:Publish fail id:%s", failIds.toString());

                                    next(null, {code: 200, msg: {}});
                                }
                            }
                        );
                    } else {
                        next(null, {code: 200, msg: 'chatHandler.push:No push user found.'});
                    }
                } else {
                    next(null, {code: 500, msg: 'chatHandler.push:Chat state inappropriate for push.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.push:Client not belongs to chat.'});
            }
        } else {
            next(null, {code: 500, msg: 'chatHandler.push:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.push:Parameter userId or chatId is empty.'});
    }
}

/**
 * @description
 *
 * Publish message to specific users not restricted in chat.
 *
 * @param msg{object} Msg contains userId, uids(array of object having uid&loginChannel), route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.pushSingle = function (msg, session, next) {
    var self = this, userId = msg.userId, uids = this.parseJSON(msg.uids), route = msg.route || this.app.get("chatRoute");
    if (userId) {
        if (uids && uids.length) {
            var arr = [];

            uids.forEach(function (item) {
                arr.push(function (cb) {
                    var loginChannel = item.loginChannel;

                    if (loginChannel) {
                        var channel = self.channelService.getChannel(loginChannel, false);

                        if (channel) {
                            var record = channel.getMember(item.uid);

                            cb(null, record);
                        } else {
                            logger.warn('chatHandler.pushSingle:User [%s] login channel not found.', item.uid);
                            cb(null, null);
                        }
                    } else {
                        logger.warn('chatHandler.pushSingle:User [%s] does not have login channel.', item.uid);
                        cb(null, null);
                    }
                });
            });

            async.waterfall([
                function (callback) {
                    async.parallel(arr, function (err, records) {
                        callback(null, records);
                    });
                },
                function (records, callback) {
                    records = _.filter(records, function (item) {
                        return item;
                    });

                    if (records.length) {
                        self.channelService.pushMessageByUids(
                            route,
                            {
                                userId: userId,
                                signal: self.app.get("messageSignal"),
                                payload: msg.payload
                            },
                            records,
                            function (err, failIds) {
                                failIds && failIds.length && logger.error("chatHandler.pushSingle:Publish fail id:%s", failIds.toString());

                                callback(err);
                            }
                        );
                    } else {
                        callback(null);
                    }
                }
            ], function (err) {
                if (err) {
                    logger.error('chatHandler.pushSingle:' + err.toString());

                    next(null, {code: 500, msg: 'chatHandler.pushSingle:' + err.toString()});
                } else {
                    next(null, {code: 200, msg: {}});
                }
            })
        } else {
            next(null, {code: 200, msg: 'chatHandler.pushSingle:No push user found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.pushSingle:Parameter userId is empty.'});
    }
}

/**
 * @description
 *
 * Publish message to topic in channel.
 *
 * @param msg{object} Msg contains userId, chatId, topicId, payload, route(optional)
 * @param session{object}
 * @param next{function}
 * @return {Void}
 */
Handler.prototype.pushTopic = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, topicId = msg.topicId, sid = this.app.get("serverId"), route = msg.route || this.app.get("chatRoute");
    if (userId && chatId && topicId && sid) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var record = channel.getMember(topicId);

            if (record && record.memberType === this.app.get("topicMemberType")) {
                if (record.topicState === this.app.get("topicOpenState")) {
                    if (this.isMemberOf(chatId, userId)) {
                        this.channelService.pushMessageByUids(
                            route,
                            {
                                chatId: chatId,
                                userId: userId,
                                topicId: topicId,
                                signal: this.app.get("topicMessageSignal"),
                                payload: msg.payload
                            },
                            [this.findTopicOwner(chatId, topicId)],
                            function (err, failIds) {
                                if (err) {
                                    logger.error('chatHandler.pushTopic:' + err.toString());

                                    next(null, {code: 500, msg: 'chatHandler.pushTopic:' + err.toString()});
                                } else {
                                    failIds && failIds.length && logger.error("chatHandler.pushTopic:Publish fail id:%s", failIds.toString());

                                    next(null, {code: 200, msg: {}});
                                }
                            }
                        );
                    } else {
                        next(null, {code: 500, msg: 'chatHandler.pushTopic:Client not belongs to chat.'});
                    }
                } else {
                    next(null, {code: 500, msg: 'chatHandler.pushTopic:Topic state inappropriate for push.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.pushTopic:Topic not found.'});
            }

        } else {
            next(null, {code: 500, msg: 'chatHandler.pushTopic:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.pushTopic:Parameter is empty.'});
    }
}
