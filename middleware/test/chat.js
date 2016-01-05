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
    loginChannel: loginChannel,
    emitter: new (require('events').EventEmitter)(),
    pomelo: new pomeloclient()
};
var userGuest1Obj = {
    userId: "52591a12c763d5e4585563ce",
    deviceId: uuid.v4(),
    loginChannel: loginChannel,
    emitter: new (require('events').EventEmitter)(),
    pomelo: new pomeloclient()
};
var userGuest2Obj = {
    userId: "52591a12c763d5e4585563cc",
    deviceId: uuid.v4(),
    loginChannel: loginChannel,
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
    'chatCloseSignal': 1008,

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
            case pomeloSignal.chatCloseSignal:
                eventType = "chatClose";
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
                var arr = [];

                [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
                    arr.push(function (callback) {
                        async.waterfall([
                            function (cb) {
                                userHostObj.pomelo.request("chat.chatHandler.invite", {
                                    userId: userHostObj.userId,
                                    uids: [{uid: userObj.userId, loginChannel: userObj.loginChannel}]
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
                                    if (data.userId === userObj.userId) {
                                        userHostObj.emitter.removeListener("accept", onAccept);
                                        cb(null);
                                    }
                                }

                                userHostObj.emitter.addListener("accept", onAccept);
                            }
                        ], function (err) {
                            callback(err);
                        });
                    });
                });

                async.parallel(arr, function (err) {
                    next(err);
                })
            },
            function (next) {
                var arr = [];

                [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
                    arr.push(function (callback) {
                        async.waterfall([
                            function (cb) {
                                function onInvite(data) {
                                    if (data.userId === userHostObj.userId) {
                                        userObj.emitter.removeListener("invite", onInvite);
                                        cb(null);
                                    }
                                }

                                userObj.emitter.addListener("invite", onInvite);
                            },
                            function (cb) {
                                userObj.pomelo.request("chat.chatHandler.acceptInvitation", {
                                    userId: userObj.userId,
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
                            callback(err);
                        });
                    });
                });

                async.parallel(arr, function (err) {
                    next(err);
                })
            }
        ], function (err) {
            should.not.exist(err);

            done();
        });
    });

    it('Single Chat with friend', function (done) {
        var msg = "Hello, friend.", uids = [], arr = [];

        [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
            uids.push({uid: userObj.userId, loginChannel: userObj.loginChannel});
        });

        arr.push(function (callback) {
            userHostObj.pomelo.request("chat.chatHandler.pushSingle", {
                userId: userHostObj.userId,
                uids: uids,
                payload: msg
            }, function (data) {
                switch (data.code) {
                    case 500:
                        callback(data.msg);
                        break;
                    case 200:
                        callback(null);
                        break;
                }
            });
        });

        [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
            arr.push(function (callback) {
                function onMessage(data) {
                    if (data.userId === userHostObj.userId && data.signal === pomeloSignal.messageSignal && data.payload === msg) {
                        userObj.emitter.removeListener("message", onMessage);
                        callback(null);
                    }
                }

                userObj.emitter.addListener("message", onMessage);
            });
        });

        async.parallel(arr, function (err) {
            should.not.exist(err);

            done();
        });
    })

    it('Chat with friends', function (done) {
        userHostObj.chatId = "32591a12c763d5e4578865f1";

        async.waterfall(
            [
                function (next) {
                    //Create chat
                    userHostObj.pomelo.request("chat.chatHandler.createChat", {
                        userId: userHostObj.userId,
                        deviceId: userHostObj.deviceId,
                        chatId: userHostObj.chatId
                    }, function (data) {
                        switch (data.code) {
                            case 500:
                                next(data.msg);
                                break;
                            case 200:
                                next(null);
                                break;
                        }
                    });
                },
                function (next) {
                    //Chat Invitation
                    var uids = [], arr = [];

                    [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
                        uids.push({uid: userObj.userId, loginChannel: userObj.loginChannel});
                    });

                    arr.push(function (callback) {
                        async.waterfall(
                            [
                                function (cb) {
                                    userHostObj.pomelo.request("chat.chatHandler.inviteChat", {
                                        userId: userHostObj.userId,
                                        uids: uids,
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
                                    var arr = [];

                                    [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
                                        arr.push(function (pCallback) {
                                            function onChatAccept(data) {
                                                if (data.userId === userObj.userId && data.chatId === userHostObj.chatId) {
                                                    userHostObj.emitter.removeListener("chatAccept", onChatAccept);
                                                    pCallback(null);
                                                }
                                            }

                                            userHostObj.emitter.addListener("chatAccept", onChatAccept);
                                        });
                                    });

                                    async.parallel(arr, function (err) {
                                        cb(err);
                                    })
                                }
                            ],
                            function (err) {
                                callback(err);
                            });
                    });

                    [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
                        arr.push(function (callback) {
                            async.waterfall(
                                [
                                    function (cb) {
                                        function onChatInvite(data) {
                                            if (data.userId === userHostObj.userId && data.chatId === userHostObj.chatId) {
                                                userObj.emitter.removeListener("chatInvite", onChatInvite);
                                                cb(null);
                                            }
                                        }

                                        userObj.emitter.addListener("chatInvite", onChatInvite);
                                    },
                                    function (cb) {
                                        userObj.pomelo.request("chat.chatHandler.acceptChatInvitation", {
                                            userId: userObj.userId,
                                            deviceId: userObj.deviceId,
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
                                        userObj.pomelo.request("chat.chatHandler.connectChat", {
                                            userId: userObj.userId,
                                            deviceId: userObj.deviceId,
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
                                    }
                                ], function (err) {
                                    callback(err);
                                }
                            );
                        });
                    });

                    async.parallel(arr, function (err) {
                        next(err);
                    });
                },
                function (next) {
                    //Chat
                    var msg = "Hello, Chat friends", arr = [];

                    arr.push(function (pCallback) {
                        userHostObj.pomelo.request("chat.chatHandler.push", {
                            userId: userHostObj.userId,
                            chatId: userHostObj.chatId,
                            payload: msg
                        }, function (data) {
                            switch (data.code) {
                                case 500:
                                    pCallback(data.msg);
                                    break;
                                case 200:
                                    pCallback(null);
                                    break;
                            }
                        });
                    });

                    [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
                        arr.push(function (pCallback) {
                            function onChatMessage(data) {
                                if (data.userId === userHostObj.userId && data.chatId === userHostObj.chatId && data.payload === msg) {
                                    userObj.emitter.removeListener("chatMessage", onChatMessage);
                                    pCallback(null);
                                }
                            }

                            userObj.emitter.addListener("chatMessage", onChatMessage);
                        });
                    });

                    async.parallel(arr, function (err) {
                        next(err);
                    })
                }
            ], function (err) {
                should.not.exist(err);

                done();
            }
        );
    })

    it('Reconnect to chat', function (done) {
        var arr = [];

        arr.push(function (pCallback) {
            userHostObj.pomelo.request("chat.chatHandler.connect", {
                userId: userHostObj.userId,
                deviceId: userHostObj.deviceId,
                chatId: userHostObj.chatId,
                loginChannel: userHostObj.loginChannel
            }, function (data) {
                switch (data.code) {
                    case 500:
                        pCallback(data.msg);
                        break;
                    case 200:
                        pCallback(null);
                        break;
                }
            });
        });

        [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
            arr.push(function (pCallback) {
                function onChatConnect(data) {
                    if (data.userId === userHostObj.userId && data.chatId === userHostObj.chatId) {
                        userObj.emitter.removeListener("chatConnect", onChatConnect);
                        pCallback(null);
                    }
                }

                userObj.emitter.addListener("chatConnect", onChatConnect);
            });
        });

        async.parallel(arr, function (err) {
            should.not.exist(err);

            done();
        })
    })

    it('Pause chat', function (done) {
        var arr = [];

        arr.push(function (pCallback) {
            userHostObj.pomelo.request("chat.chatHandler.pauseChat", {
                userId: userHostObj.userId,
                chatId: userHostObj.chatId
            }, function (data) {
                switch (data.code) {
                    case 500:
                        pCallback(data.msg);
                        break;
                    case 200:
                        pCallback(null);
                        break;
                }
            });
        });

        [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
            arr.push(function (pCallback) {
                function onChatPause(data) {
                    if (data.userId === userHostObj.userId && data.chatId === userHostObj.chatId) {
                        userObj.emitter.removeListener("chatPause", onChatPause);
                        pCallback(null);
                    }
                }

                userObj.emitter.addListener("chatPause", onChatPause);
            });
        });

        async.parallel(arr, function (err) {
            should.not.exist(err);

            done();
        })
    })

    it('Resume chat', function (done) {
        var arr = [];

        arr.push(function (pCallback) {
            userHostObj.pomelo.request("chat.chatHandler.resumeChat", {
                userId: userHostObj.userId,
                chatId: userHostObj.chatId
            }, function (data) {
                switch (data.code) {
                    case 500:
                        pCallback(data.msg);
                        break;
                    case 200:
                        pCallback(null);
                        break;
                }
            });
        });

        [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
            arr.push(function (pCallback) {
                function onChatResume(data) {
                    if (data.userId === userHostObj.userId && data.chatId === userHostObj.chatId) {
                        userObj.emitter.removeListener("chatResume", onChatResume);
                        pCallback(null);
                    }
                }

                userObj.emitter.addListener("chatResume", onChatResume);
            });
        });

        async.parallel(arr, function (err) {
            should.not.exist(err);

            done();
        })
    })

    it('Leave chat', function (done) {
        var arr = [];

        arr.push(function (pCallback) {
            userHostObj.pomelo.request("chat.chatHandler.disconnectChat", {
                userId: userHostObj.userId,
                chatId: userHostObj.chatId
            }, function (data) {
                switch (data.code) {
                    case 500:
                        pCallback(data.msg);
                        break;
                    case 200:
                        pCallback(null);
                        break;
                }
            });
        });

        [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
            arr.push(function (pCallback) {
                function onChatDisconnect(data) {
                    if (data.userId === userHostObj.userId && data.chatId === userHostObj.chatId) {
                        userObj.emitter.removeListener("chatDisconnect", onChatDisconnect);
                        pCallback(null);
                    }
                }

                userObj.emitter.addListener("chatDisconnect", onChatDisconnect);
            });
        });

        async.waterfall([
            function (next) {
                async.parallel(arr, function (err) {
                    next(err);
                })
            }, function (next) {
                userHostObj.pomelo.request("chat.chatHandler.connect", {
                    userId: userHostObj.userId,
                    deviceId: userHostObj.deviceId,
                    chatId: userHostObj.chatId
                }, function (data) {
                    switch (data.code) {
                        case 500:
                            next(data.msg);
                            break;
                        case 200:
                            next(null);
                            break;
                    }
                });
            }
        ], function (err) {
            should.not.exist(err);

            done();
        });
    })

    it('Start a topic', function (done) {
        userHostObj.topicId = "52591a12c763d5e4587763ae";

        async.waterfall([
            function (next) {
                userHostObj.pomelo.request("chat.chatHandler.createTopic", {
                    userId: userHostObj.userId,
                    chatId: userHostObj.chatId,
                    topicId: userHostObj.topicId,
                    deviceId: userHostObj.deviceId
                }, function (data) {
                    switch (data.code) {
                        case 500:
                            next(data.msg);
                            break;
                        case 200:
                            next(null);
                            break;
                    }
                });
            },
            function (next) {
                var arr = [];

                arr.push(function (pCallback) {
                    userHostObj.pomelo.request("chat.chatHandler.inviteTopic", {
                        userId: userHostObj.userId,
                        chatId: userHostObj.chatId,
                        topicId: userHostObj.topicId
                    }, function (data) {
                        switch (data.code) {
                            case 500:
                                pCallback(data.msg);
                                break;
                            case 200:
                                pCallback(null);
                                break;
                        }
                    });
                });

                [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
                    arr.push(function (pCallback) {
                        function onTopicInvite(data) {
                            if (data.userId === userHostObj.userId && data.chatId === userHostObj.chatId && data.topicId === userHostObj.topicId) {
                                userObj.emitter.removeListener("topicInvite", onTopicInvite);
                                pCallback(null);
                            }
                        }

                        userObj.emitter.addListener("topicInvite", onTopicInvite);
                    });
                });

                async.parallel(arr, function (err) {
                    next(err);
                })
            }
        ], function (err) {
            should.not.exist(err);

            done();
        });
    })

    it('Send message to topic', function (done) {
        var msg = "Let's vote against greenhouse air emission";

        async.parallel([
            function (next) {
                async.each([userGuest1Obj, userGuest2Obj], function (userObj, callback) {
                    function onTopicMessage(data) {
                        if (data.userId === userObj.userId && data.payload === msg && data.chatId === userHostObj.chatId && data.topicId === userHostObj.topicId) {
                            userObj.emitter.removeListener("topicMessage", onTopicMessage);
                            callback(null);
                        }
                    }

                    userHostObj.emitter.addListener("topicMessage", onTopicMessage);
                }, function (err) {
                    next(err);
                });
            },
            function (next) {
                async.each([userGuest1Obj, userGuest2Obj], function (userObj, callback) {
                    userObj.pomelo.request("chat.chatHandler.pushTopic", {
                        userId: userObj.userId,
                        chatId: userHostObj.chatId,
                        topicId:userHostObj.topicId,
                        payload: msg
                    }, function (data) {
                        switch (data.code) {
                            case 500:
                                callback(data.msg);
                                break;
                            case 200:
                                callback(null);
                                break;
                        }
                    });
                }, function (err) {
                    next(err);
                });
            }
        ], function (err) {
            should.not.exist(err);

            done();
        })
    })

    it('Pause topic', function (done) {
        var arr = [];

        arr.push(function (pCallback) {
            userHostObj.pomelo.request("chat.chatHandler.pauseTopic", {
                userId: userHostObj.userId,
                chatId: userHostObj.chatId,
                topicId: userHostObj.topicId
            }, function (data) {
                switch (data.code) {
                    case 500:
                        pCallback(data.msg);
                        break;
                    case 200:
                        pCallback(null);
                        break;
                }
            });
        });

        [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
            arr.push(function (pCallback) {
                function onTopicPause(data) {
                    if (data.userId === userHostObj.userId && data.chatId === userHostObj.chatId && data.topicId === userHostObj.topicId) {
                        userObj.emitter.removeListener("topicPause", onTopicPause);
                        pCallback(null);
                    }
                }

                userObj.emitter.addListener("topicPause", onTopicPause);
            });
        });

        async.parallel(arr, function (err) {
            should.not.exist(err);

            done();
        })
    })

    it('Resume topic', function (done) {
        var arr = [];

        arr.push(function (pCallback) {
            userHostObj.pomelo.request("chat.chatHandler.resumeTopic", {
                userId: userHostObj.userId,
                chatId: userHostObj.chatId,
                topicId: userHostObj.topicId
            }, function (data) {
                switch (data.code) {
                    case 500:
                        pCallback(data.msg);
                        break;
                    case 200:
                        pCallback(null);
                        break;
                }
            });
        });

        [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
            arr.push(function (pCallback) {
                function onTopicResume(data) {
                    if (data.userId === userHostObj.userId && data.chatId === userHostObj.chatId && data.topicId === userHostObj.topicId) {
                        userObj.emitter.removeListener("topicResume", onTopicResume);
                        pCallback(null);
                    }
                }

                userObj.emitter.addListener("topicResume", onTopicResume);
            });
        });

        async.parallel(arr, function (err) {
            should.not.exist(err);

            done();
        })
    })

    it('End topic', function (done) {
        var arr = [];

        arr.push(function (pCallback) {
            userHostObj.pomelo.request("chat.chatHandler.closeTopic", {
                userId: userHostObj.userId,
                chatId: userHostObj.chatId,
                topicId: userHostObj.topicId
            }, function (data) {
                switch (data.code) {
                    case 500:
                        pCallback(data.msg);
                        break;
                    case 200:
                        pCallback(null);
                        break;
                }
            });
        });

        [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
            arr.push(function (pCallback) {
                function onTopicClose(data) {
                    if (data.userId === userHostObj.userId && data.chatId === userHostObj.chatId && data.topicId === userHostObj.topicId) {
                        userObj.emitter.removeListener("topicClose", onTopicClose);
                        pCallback(null);
                    }
                }

                userObj.emitter.addListener("topicClose", onTopicClose);
            });
        });

        async.parallel(arr, function (err) {
            delete userHostObj.topicId;

            should.not.exist(err);

            done();
        })
    });

    it('End chat', function (done) {
        var arr = [];

        arr.push(function (pCallback) {
            userHostObj.pomelo.request("chat.chatHandler.closeChat", {
                userId: userHostObj.userId,
                chatId: userHostObj.chatId
            }, function (data) {
                switch (data.code) {
                    case 500:
                        pCallback(data.msg);
                        break;
                    case 200:
                        pCallback(null);
                        break;
                }
            });
        });

        [userGuest1Obj, userGuest2Obj].forEach(function (userObj) {
            arr.push(function (pCallback) {
                function onChatClose(data) {
                    if (data.userId === userHostObj.userId && data.chatId === userHostObj.chatId && data.topicId === userHostObj.topicId) {
                        userObj.emitter.removeListener("chatClose", onChatClose);
                        pCallback(null);
                    }
                }

                userObj.emitter.addListener("chatClose", onChatClose);
            });
        });

        async.parallel(arr, function (err) {
            delete userHostObj.chatId;

            should.not.exist(err);

            done();
        })
    });

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