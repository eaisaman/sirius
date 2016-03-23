var fs = require('fs');
var pomelo = require('pomelo');

/**
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'sirius');

app.set('chatRoute', 'SIRIUS_CHAT_ROUTE');
app.set('loginChannel', 'SIRIUS_LOGIN_CHANNEL');

app.set('inviteSignal', 901);
app.set('messageSignal', 902);
app.set('acceptSignal', 903);

app.set('chatInviteSignal', 1001);
app.set('chatConnectSignal', 1002);
app.set('chatDisconnectSignal', 1003);
app.set('chatPauseSignal', 1004);
app.set('chatResumeSignal', 1005);
app.set('chatMessageSignal', 1006);
app.set('chatAcceptSignal', 1007);
app.set('chatCloseSignal', 1008);

app.set('topicInviteSignal', 2001);
app.set('topicPauseSignal', 2002);
app.set('topicResumeSignal', 2003);
app.set('topicMessageSignal', 2004);
app.set('topicCloseSignal', 2005);
app.set('topicDisconnectSignal', 2006);

app.set('creatorCategory', 1);
app.set('guestCategory', 2);

app.set('userMemberType', 1);
app.set('topicMemberType', 2);

app.set('chatOpenState', 1);
app.set('chatPauseState', 2);
app.set('chatCloseState', 3);
app.set('chatDestroyState', 4);

app.set('topicOpenState', 11);
app.set('topicPauseState', 12);
app.set('topicCloseState', 13);
app.set('topicDestroyState', 14);

app.set('conversationTextType', 1);
app.set('conversationImageType', 2);
app.set('conversationVideoType', 3);
app.set('conversationLocationType', 4);
app.set('conversationVoiceType', 5);
app.set('conversationFileType', 6);

// app configuration
app.configure('production|development', 'all', function () {
    //For engine.io-parser@0.6.3, the first byte of payload should be packet type
    //2. ping, 3. pong, 4. message, 5. upgrade, 6.noop
    //See io.socket.engineio.parser.Parser for reference

    pomelo.connectors.hybridconnector.prototype.emit = function (type) {
        var args = Array.prototype.slice.call(arguments);
        if (type === "connection") {
            var self = this,
                hybridsocket = args[1],
                socket = hybridsocket.socket;

            var sessionService = app.get('sessionService');

            var listeners = socket.listeners("message");
            socket.removeAllListeners("message");
            listeners && listeners.forEach(function (fn) {
                socket.addListener("message", function (msg) {
                    var args = Array.prototype.slice.call(arguments);

                    var session = sessionService.get(hybridsocket.id);

                    if (session) {
                        var clientConfig = session.get("clientConfig");
                        if (!clientConfig) {
                            clientConfig = {};
                            session.set("clientConfig", clientConfig);
                        }

                        if (clientConfig.payloadStart == null) {
                            if (args[0]) {
                                //decode, test the payload start location
                                var offset;
                                for (var i = 0; i < 10; i++) {
                                    if (i + 3 < msg.length) {
                                        var type = msg[i];
                                        var length = (msg[i + 1]) << 16 | (msg[i + 2]) << 8 | msg[i + 3];
                                        if (length == msg.length - i - 4) {
                                            offset = i;
                                            break;
                                        }
                                    }
                                }
                                if (offset != null) {
                                    clientConfig.payloadStart = offset;
                                    if (offset) clientConfig.payloadAhead = msg.slice(0, offset);
                                    args[0] = msg.slice(offset);
                                } else {
                                    args[0] = null;
                                }
                                if (args[1]) args[1].buffer = args[0];
                            }
                        }

                        if (clientConfig.payloadStart != null) {
                            if (clientConfig.payloadStart) clientConfig.payloadAhead = msg.slice(0, clientConfig.payloadStart);
                            args[0] = msg.slice(clientConfig.payloadStart);
                        } else {
                            args[0] = null;
                        }
                    }
                    if (args[1]) args[1].buffer = args[0];

                    fn.apply(null, args)
                });
            });

            //encode, add packet type as the first byte
            hybridsocket.prependPayload = function (msg) {
                if (msg instanceof String) {
                    msg = new Buffer(msg);
                } else if (!(msg instanceof Buffer)) {
                    msg = new Buffer(JSON.stringify(msg));
                }

                var session = sessionService.get(this.id);

                if (session) {
                    var clientConfig = session.get("clientConfig");

                    if (clientConfig && clientConfig.payloadStart) {
                        msg = Buffer.concat([clientConfig.payloadAhead, msg]);
                    }
                }

                return msg;
            }

            hybridsocket.sendRaw = function (msg) {
                var args = Array.prototype.slice.call(arguments);
                if (args[0]) {
                    args[0] = this.prependPayload(args[0]);
                }

                hybridsocket.constructor.prototype.sendRaw.apply(hybridsocket, args);
            }

            hybridsocket.sendForce = function (msg) {
                var args = Array.prototype.slice.call(arguments);
                if (args[0]) {
                    args[0] = this.prependPayload(args[0]);
                }

                hybridsocket.constructor.prototype.sendForce.apply(hybridsocket, args);
            }

            hybridsocket.handshakeResponse = function (resp) {
                var args = Array.prototype.slice.call(arguments);
                if (args[0]) {
                    args[0] = this.prependPayload(args[0]);
                }

                hybridsocket.constructor.prototype.handshakeResponse.apply(hybridsocket, args);
            }
        }

        pomelo.connectors.hybridconnector.prototype.__proto__.emit.apply(this, args);
    }

    app.set('connectorConfig',
        {
            connector: pomelo.connectors.hybridconnector,
            //connector: pomelo.connectors.sioconnector,
            heartbeat: 3,
            useDict: true,
            useProtobuf: false
            //Comment to use HTTP mode
            //key: fs.readFileSync('../shared/server.key'),
            //cert: fs.readFileSync('../shared/server.crt')
        });
});

// start app
app.start();

process.on('uncaughtException', function (err) {
    console.error(' Caught exception: ' + err.stack);
});