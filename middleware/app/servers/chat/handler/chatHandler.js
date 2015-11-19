var _ = require('underscore');
_.string = require('underscore.string');
_.mixin(_.string.exports());

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
            var record = channel.getMember("topicId");

            if (record && record.memberType === self.app.get("topicMemberType")) {
                return record.topicState;
            }
        }

        return self.app.get("topicDestroyState");
    }

    self.getClientIds = function (chatId, userId) {
        var channel = self.channelService.getChannel(chatId, false);

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

                return null;
            } else {
                return arrayPick(_.where(_.values(channel.records), {memberType: this.app.get("userMemberType")}), "uid", "sid");
            }
        } else {
            return null;
        }
    }

    self.getOtherClientIds = function (chatId, userId) {
        var channel = self.channelService.getChannel(chatId, false);

        if (channel) {
            var arr = arrayPick(_.where(_.values(channel.records), {memberType: this.app.get("userMemberType")}), "uid", "sid");

            return _.reject(arr, function (item) {
                return item.uid === userId;
            });
        } else {
            return [];
        }
    }

    self.parseJSON = function(str) {
        if(typeof str === "string") {
            if (str === "undefined" || str === "null") {
                return null;
            } else {
                try {
                    str = JSON.parse(str);
                } catch(err) {
                    //TODO Print err to log
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

    self.clearOldSession = function(userId, session) {
        var sessionService = self.app.get('sessionService'), oldSessions = sessionService.getByUid(userId),
            ret = false;

        if (oldSessions && oldSessions.length) {
            oldSessions.forEach(function(oldSession) {
                if (oldSession.id !== session.id) {
                    ret = true;
                    //TODO Should call completion callback after all old sessions unbind successfully
                    sessionService.unbind(oldSession.id, userId, function (err) {
                        //TODO Print err to log
                    });
                }                
            });
        }

        return ret;
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

    self.sessionCloseListener = function (route, chatId, userId, sid, userInfo, session) {
        if (session && session.uid) {
            var channel = this.channelService.getChannel(chatId, false);

            if (channel) {
                if (userInfo.category === this.app.get("guestCategory")) {
                    channel.leave(userId, sid);

                    var uids = this.getOtherClientIds(chatId, userId);
                    this.channelService.pushMessageByUids(
                        route,
                        {
                            chatId: chatId,
                            userId: userId,
                            signal: this.app.get("disconnectSignal")
                        },
                        uids,
                        function (err, failIds) {
                            if (err) {
                                //TODO Print err to log
                            } else {
                                //TODO Print fail ids to log
                            }
                        }
                    );
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
 * Create chat, add creator. The chat state will be saved in the record of creator. All other clients' record
 * will be cleaned if his session closed except for the creator's record. It will be populated to a new record
 * if the creator reconnects to the chat.
 *
 * @return {Void}
 */
Handler.prototype.create = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, deviceId = msg.deviceId, sid = this.app.get("serverId"), route = msg.route || this.app.get("chatRoute");
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

        this.clearOldSession(userId, session);
        session.bind(userId);
        session.on("closed", this.sessionCloseListener.bind(this, route, chatId, userId, sid, {category: record.category}));

        next(null, {code: 200, msg: {}});
    } else {
        next(null, {code: 500, msg: 'chatHandler.create:Parameter is empty.'});
    }
};

/**
 * Add client to channel, publish client connect signal to all other clients. The chat state will be returned too.
 * If creator reconnects, the old record will be populated to the new one.
 *
 * @return {Void}
 */
Handler.prototype.connect = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, deviceId = msg.deviceId, sid = this.app.get("serverId"), route = msg.route || this.app.get("chatRoute");
    if (userId && chatId && deviceId && sid) {
        //Create login channel if not exist
        var channel = this.channelService.getChannel(chatId, chatId === this.app.get('loginChannel'));
        if (channel) {
            var chatState = this.getChatState(chatId),
                record = channel.getMember(userId),
                category = this.app.get("guestCategory"),
                memberType = this.app.get("userMemberType");
            if (record) {
                category = record.category;
                memberType = record.memberType;
                if (record.deviceId !== deviceId) {
                    channel.leave(record.uid, record.sid);
                    record = null;
                }
            }

            var uids = this.getClientIds(chatId);

            if (!record) {
                channel.add(userId, sid);
                record = channel.getMember(userId);
                record.deviceId = deviceId;
                record.memberType = memberType;
                record.category = category;
                record.chatState = chatState;
            }

            if (category === this.app.get("guestCategory")) {
                this.clearOldSession(userId, session);
                session.bind(userId);
                session.on("closed", this.sessionCloseListener.bind(this, route, chatId, userId, sid, {category: category}));
            }

            if (uids && uids.length) {
                this.channelService.pushMessageByUids(
                    route,
                    {
                        chatId: chatId,
                        signal: this.app.get("connectSignal"),
                        userId: userId,
                        chatState: chatState
                    },
                    uids,
                    function (err, failIds) {
                        //TODO Print fail ids to log
                        if (err) {
                            next(null, {code: 500, msg: 'chatHandler.connect:' + err.toString()});
                        } else {
                            next(null, {code: 200, msg: {}});
                        }
                    }
                );
            } else {
                next(null, {code: 200, msg: {}});
            }
        } else {
            next(null, {code: 500, msg: 'chatHandler.connect:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.connect:Parameter is empty.'});
    }
};

/**
 * Publish pause signal to all connected clients, only creator is allowed to.
 *
 * @return {Void}
 */
Handler.prototype.pause = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, route = msg.route || this.app.get("chatRoute");
    if (userId && chatId) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var record = channel.getMember(userId);
            if (record) {
                if (this.getChatCreator(chatId) === userId) {
                    record.chatState = this.app.get("chatPauseState");

                    var uids = this.getOtherClientIds(chatId, userId);

                    if (uids && uids.length) {
                        this.channelService.pushMessageByUids(
                            route,
                            {
                                chatId: chatId,
                                signal: this.app.get("pauseSignal"),
                                userId: userId,
                                chatState: this.app.get("chatPauseState")
                            },
                            uids,
                            function (err, failIds) {
                                if (err) {
                                    next(null, {code: 500, msg: 'chatHandler.pause:' + err.toString()});
                                } else {
                                    //TODO Print fail ids count to log
                                    next(null, {
                                        code: 200,
                                        msg: {}
                                    });
                                }
                            }
                        );
                    } else {
                        next(null, {code: 200, msg: 'chatHandler.pause:No push user found.'});
                    }
                } else {
                    next(null, {code: 500, msg: 'chatHandler.pause:Only chat creator is allowed to.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.pause:Client not belongs to the chat.'});
            }
        } else {
            next(null, {code: 500, msg: 'chatHandler.pause:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.pause:Parameter userId or chatId is empty.'});
    }
};

/**
 * Publish resume signal to all connected clients, only creator is allowed to. The containing topics will be resumed as well.
 *
 * @return {Void}
 */
Handler.prototype.resume = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, route = msg.route || this.app.get("chatRoute");
    if (userId && chatId) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var record = channel.getMember(userId);
            if (record) {
                if (this.getChatCreator(chatId) === userId) {
                    record.chatState = this.app.get("chatOpenState");

                    var uids = this.getOtherClientIds(chatId, userId);

                    if (uids && uids.length) {
                        this.channelService.pushMessageByUids(
                            route,
                            {
                                chatId: chatId,
                                userId: userId,
                                signal: this.app.get("resumeSignal"),
                                chatState: this.app.get("chatOpenState")
                            },
                            uids,
                            function (err, failIds) {
                                //TODO Print fail ids to log
                                if (err) {
                                    next(null, {code: 500, msg: 'chatHandler.resume:' + err.toString()});
                                } else {
                                    next(null, {code: 200, msg: {}});
                                }
                            }
                        );
                    } else {
                        next(null, {code: 200, msg: 'chatHandler.resume:No push user found.'});
                    }
                } else {
                    next(null, {code: 500, msg: 'chatHandler.resume:Only chat creator is allowed to.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.resume:Client not belongs to the chat.'});
            }
        } else {
            next(null, {code: 500, msg: 'chatHandler.resume:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.resume:Parameter userId or chatId is empty.'});
    }
};

/**
 * Publish invite signal to all connected clients in login channel.
 *
 * @return {Void}
 */
Handler.prototype.invite = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId, uids = this.getClientIds(this.app.get('loginChannel'), this.parseJSON(msg.uids)), route = msg.route || this.app.get("chatRoute");
    if (userId && chatId) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var record = channel.getMember(userId);
            if (record) {
                if (uids && uids.length) {
                    this.channelService.pushMessageByUids(
                        route,
                        {
                            chatId: chatId,
                            userId: userId,
                            signal: this.app.get("inviteSignal"),
                            chatState: this.getChatState(chatId)
                        },
                        uids,
                        function (err, failIds) {
                            //TODO Print fail ids to log
                            if (err) {
                                next(null, {code: 500, msg: 'chatHandler.invite:' + err.toString()});
                            } else {
                                next(null, {code: 200, msg: {}});
                            }
                        }
                    );
                } else {
                    next(null, {code: 200, msg: 'chatHandler.invite:No push user found.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.invite:Client not belongs to the chat.'});
            }
        } else {
            next(null, {code: 500, msg: 'chatHandler.invite:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.invite:Parameter userId or chatId is empty.'});
    }
};

/**
 * Destroy channel, only creator is allowed to.
 *
 * @return {Void}
 */
Handler.prototype.close = function (msg, session, next) {
    var userId = msg.userId, chatId = msg.chatId;
    if (userId && chatId) {
        var channel = this.channelService.getChannel(chatId, false);
        if (channel) {
            var record = channel.getMember(userId);
            if (record) {
                if (record.category === this.app.get("creatorCategory")) {
                    this.channelService.destroyChannel(chatId);
                    next(null, {code: 200, msg: 'chatHandler.close:Channel destroyed.'});
                } else {
                    next(null, {code: 500, msg: 'chatHandler.close:Only creator is allowed to.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.close:Client not belongs to chat.'});
            }
        } else {
            next(null, {code: 500, msg: 'chatHandler.close:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.close:Parameter userId or chatId is empty.'});
    }
};

/**
 * Create topic, broadcast topic to other clients in channel. Topic is a special kind of channel member.
 *
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
 * Change topic state to pause, send pause topic signal to all clients in channel. Only topic creator is allowed to.
 *
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
                                //TODO Print fail ids to log
                                if (err) {
                                    next(null, {code: 500, msg: 'chatHandler.pauseTopic:' + err.toString()});
                                } else {
                                    next(null, {code: 200, msg: {}});
                                }
                            }
                        );
                    } else {
                        next(null, {code: 200, msg: 'chatHandler.pauseTopic:No user found.'});
                    }
                } else {
                    next(null, {code: 500, msg: 'chatHandler.pauseTopic:Only topic creator is allowed.'});
                }
            } else {
                next(null, {code: 500, msg: 'chatHandler.pauseTopic:Topic not found.'});
            }

        } else {
            next(null, {code: 500, msg: 'chatHandler.pauseTopic:Chat not found.'});
        }
    } else {
        next(null, {code: 500, msg: 'chatHandler.pauseTopic:Parameter is empty.'});
    }
};

/**
 * Change topic state to open, send resume topic signal to all clients in channel. Only topic creator is allowed to.
 *
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
                                //TODO Print fail ids to log
                                if (err) {
                                    next(null, {code: 500, msg: 'chatHandler.resumeTopic:' + err.toString()});
                                } else {
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
 * Invite to join topic, send invite topic signal to all clients, if not specified, in channel. Only topic creator is allowed to.
 *
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
                                //TODO Print fail ids to log
                                if (err) {
                                    next(null, {code: 500, msg: 'chatHandler.inviteTopic:' + err.toString()});
                                } else {
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
 * Close topic. Only topic creator is allowed to.
 *
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
                                //TODO Print fail ids to log
                                if (err) {
                                    next(null, {code: 500, msg: 'chatHandler.closeTopic:' + err.toString()});
                                } else {
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
 * Publish message to all connected clients, if not specified, in channel.
 *
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
                                signal: this.app.get("messageSignal"),
                                payload: msg.payload
                            },
                            uids,
                            function (err, failIds) {
                                //TODO Print fail ids to log
                                if (err) {
                                    next(null, {code: 500, msg: 'chatHandler.push:' + err.toString()});
                                } else {
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
 * Publish message to topic in channel.
 *
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
                                //TODO Print fail ids to log
                                if (err) {
                                    next(null, {code: 500, msg: 'chatHandler.pushTopic:' + err.toString()});
                                } else {
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
