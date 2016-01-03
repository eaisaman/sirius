global.io = require("socket.io-client");
var pomeloclient = require('../pomeloclient').pomelo;

var should = require("should");
var async = require('async');
var _ = require('underscore');
var uuid = require('node-uuid');

var host = process.env['mocha.host'];
var port = process.env['mocha.port'];
var route = process.env['mocha.route'];
var loginChannel = process.env['mocha.loginChannel'];

var userHostObj = {
    userId: "52591a12c763d5e4585563d0",
    deviceId: uuid.v4(),
    loginChannel:loginChannel,
    emitter: new (require('events').EventEmitter)(),
    pomelo: new pomeloclient()
};
var userGuest1Obj = {
    userId: "52591a12c763d5e4585563ce",
    deviceId: uuid.v4(),
    loginChannel:loginChannel,
    emitter: new (require('events').EventEmitter)(),
    pomelo: new pomeloclient()
};
var userGuest2Obj = {
    userId: "52591a12c763d5e4585563cc",
    deviceId: uuid.v4(),
    loginChannel:loginChannel,
    emitter: new (require('events').EventEmitter)(),
    pomelo: new pomeloclient()
};

var pomeloSignal = {
    'inviteSignal': 901,
    'messageSignal': 902,
    'acceptSignal': 903,

    'chatInviteSignal': 1001,
    'chatConnectSignal': 1002,
    'chatDisconnectSignal': 1003,
    'chatPauseSignal': 1004,
    'chatResumeSignal': 1005,
    'chatMessageSignal': 1006,
    'chatAcceptSignal': 1007,

    'topicInviteSignal': 2001,
    'topicPauseSignal': 2002,
    'topicResumeSignal': 2003,
    'topicMessageSignal': 2004,
    'topicCloseSignal': 2005,
    'topicDisconnectSignal': 2006
}

function onEvent(emitter) {
    return function (data) {
        var signal = data.signal,
            eventType;

        switch (signal) {
            case pomeloSignal.inviteSignal:
                eventType = "invite";
                break;
            case pomeloSignal.messageSignal:
                eventType = "message";
                break;
            case pomeloSignal.acceptSignal:
                eventType = "accept";
                break;
            case pomeloSignal.chatInviteSignal:
                eventType = "chatInvite";
                break;
            case pomeloSignal.chatConnectSignal:
                eventType = "chatConnect";
                break;
            case pomeloSignal.chatDisconnectSignal:
                eventType = "chatDisconnect";
                break;
            case pomeloSignal.chatPauseSignal:
                eventType = "chatPause";
                break;
            case pomeloSignal.chatResumeSignal:
                eventType = "chatResume";
                break;
            case pomeloSignal.chatMessageSignal:
                eventType = "chatMessage";
                break;
            case pomeloSignal.chatAcceptSignal:
                eventType = "chatAccept";
                break;
            case pomeloSignal.topicInviteSignal:
                eventType = "topicInvite";
                break;
            case pomeloSignal.topicPauseSignal:
                eventType = "topicPause";
                break;
            case pomeloSignal.topicResumeSignal:
                eventType = "topicResume";
                break;
            case pomeloSignal.topicMessageSignal:
                eventType = "topicMessage";
                break;
            case pomeloSignal.topicCloseSignal:
                eventType = "topicClose";
                break;
            case pomeloSignal.topicDisconnectSignal:
                eventType = "topicDisconnect";
                break;
        }

        emitter.emit(eventType, data);
    }
}

describe('Chat', function () {
    before('Log in', function (done) {
        async.waterfall([
            function (next) {
                async.waterfall([
                    function (cb) {
                        userHostObj.pomelo.init({host: host, port: port}, function () {
                            userHostObj.pomelo.on(route, onEvent(userHostObj.emitter));

                            cb(null);
                        }, function (err) {
                            cb(err);
                        });
                    },
                    function (cb) {
                        userGuest1Obj.pomelo.init({host: host, port: port}, function () {
                            userGuest1Obj.pomelo.on(route, onEvent(userGuest1Obj.emitter));

                            cb(null);
                        }, function (err) {
                            cb(err);
                        });
                    },
                    function (cb) {
                        userGuest2Obj.pomelo.init({host: host, port: port}, function () {
                            userGuest2Obj.pomelo.on(route, onEvent(userGuest2Obj.emitter));

                            cb(null);
                        }, function (err) {
                            cb(err);
                        });
                    }
                ], function (err) {
                    next(err);
                });
            },
            function (next) {
                async.parallel([
                    function (cb) {
                        userHostObj.pomelo.request("chat.chatHandler.connect", {
                            userId: userHostObj.userId,
                            deviceId: userHostObj.deviceId
                        }, function (data) {
                            switch (data.code) {
                                case 500:
                                    cb(data.msg);
                                    break;
                                case 200:
                                    cb(null);
                                    break;
                            }
                        });
                    },
                    function (cb) {
                        userGuest1Obj.pomelo.request("chat.chatHandler.connect", {
                            userId: userGuest1Obj.userId,
                            deviceId: userGuest1Obj.deviceId
                        }, function (data) {
                            switch (data.code) {
                                case 500:
                                    cb(data.msg);
                                    break;
                                case 200:
                                    cb(null);
                                    break;
                            }
                        });
                    },
                    function (cb) {
                        userGuest2Obj.pomelo.request("chat.chatHandler.connect", {
                            userId: userGuest2Obj.userId,
                            deviceId: userGuest2Obj.deviceId
                        }, function (data) {
                            switch (data.code) {
                                case 500:
                                    cb(data.msg);
                                    break;
                                case 200:
                                    cb(null);
                                    break;
                            }
                        });
                    }
                ], function (err) {
                    next(err);
                });
            }
        ], function (err) {
            should.not.exist(err);

            done();
        });
    });

    it('Make friends', function (done) {
        async.parallel([
            function (next) {
                async.waterfall([
                    function (cb) {
                        userHostObj.pomelo.request("chat.chatHandler.invite", {
                            userId: userHostObj.userId,
                            uids: [{uid: userGuest1Obj.userId, loginChannel: userGuest1Obj.loginChannel}]
                        }, function (data) {
                            switch (data.code) {
                                case 500:
                                    cb(data.msg);
                                    break;
                                case 200:
                                    cb(null);
                                    break;
                            }
                        });
                    },
                    function (cb) {
                        function onAccept(data) {
                            if (data.userId === userGuest1Obj.userId) {
                                userHostObj.emitter.removeListener("accept", onAccept);
                                cb(null);
                            }
                        }

                        userHostObj.emitter.addListener("accept", onAccept);
                    }
                ], function (err) {
                    next(err);
                });
            },
            function (next) {
                async.waterfall([
                    function (cb) {
                        function onInvite(data) {
                            if (data.userId === userHostObj.userId) {
                                userGuest1Obj.emitter.removeListener("invite", onInvite);
                                cb(null);
                            }
                        }

                        userGuest1Obj.emitter.addListener("invite", onInvite);
                    },
                    function (cb) {
                        userGuest1Obj.pomelo.request("chat.chatHandler.acceptInvitation", {
                            userId: userGuest1Obj.userId,
                            creatorId: userHostObj.userId,
                            creatorLoginChannel: userHostObj.loginChannel
                        }, function (data) {
                            switch (data.code) {
                                case 500:
                                    cb(data.msg);
                                    break;
                                case 200:
                                    cb(null);
                                    break;
                            }
                        });
                    }
                ], function (err) {
                    next(err);
                });
            }
        ], function (err) {
            should.not.exist(err);

            done();
        });
    });

    it('Chat with friends', function (done) {
        done();
    })

    it('Reconnect to chat', function (done) {
        done();
    })

    it('Pause chat', function (done) {
        done();
    })

    it('Resume chat', function (done) {
        done();
    })

    it('Leave chat', function (done) {
        done();
    })

    it('Start a topic', function (done) {
        done();
    })

    it('Pause topic', function (done) {
        done();
    })

    it('Resume topic', function (done) {
        done();
    })

    it('End topic', function (done) {
        done();
    })

    it('End chat', function (done) {
        done();
    })

    after('Log out', function (done) {
        async.waterfall(
            [
                function (next) {
                    async.parallel([
                        function (cb) {
                            userHostObj.pomelo.request("chat.chatHandler.disconnect", {
                                userId: userHostObj.userId,
                                deviceId: userHostObj.deviceId,
                                chatId: userHostObj.chatId
                            }, function (data) {
                                switch (data.code) {
                                    case 500:
                                        cb(data.msg);
                                        break;
                                    case 200:
                                        cb(null);
                                        break;
                                }
                            });
                        },
                        function (cb) {
                            userGuest1Obj.pomelo.request("chat.chatHandler.disconnect", {
                                userId: userGuest1Obj.userId,
                                deviceId: userGuest1Obj.deviceId,
                                chatId: userGuest1Obj.chatId
                            }, function (data) {
                                switch (data.code) {
                                    case 500:
                                        cb(data.msg);
                                        break;
                                    case 200:
                                        cb(null);
                                        break;
                                }
                            });
                        },
                        function (cb) {
                            userGuest2Obj.pomelo.request("chat.chatHandler.disconnect", {
                                userId: userGuest2Obj.userId,
                                deviceId: userGuest2Obj.deviceId,
                                chatId: userGuest2Obj.chatId
                            }, function (data) {
                                switch (data.code) {
                                    case 500:
                                        cb(data.msg);
                                        break;
                                    case 200:
                                        cb(null);
                                        break;
                                }
                            });
                        }
                    ], function (err) {
                        next(err);
                    });
                },
                function (next) {
                    async.parallel([
                        function (cb) {
                            try {
                                userHostObj.pomelo.disconnect();
                                cb(null);
                            } catch (err) {
                                cb(err);
                            }
                        },
                        function (cb) {
                            try {
                                userGuest1Obj.pomelo.disconnect();
                                cb(null);
                            } catch (err) {
                                cb(err);
                            }
                        },
                        function (cb) {
                            try {
                                userGuest2Obj.pomelo.disconnect();
                                cb(null);
                            } catch (err) {
                                cb(err);
                            }
                        }
                    ], function (err) {
                        next(err);
                    });
                }
            ], function (err) {
                should.not.exist(err);

                done();
            }
        );
    });
});