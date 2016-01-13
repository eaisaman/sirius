(function (exports, GLOBAL) {
    var isArray = Array.isArray;

    var root = exports;

    function EventEmitter() {
    }

    root.EventEmitter = EventEmitter;

    // By default EventEmitters will print a warning if more than
    // 10 listeners are added to it. This is a useful default which
    // helps finding memory leaks.
    //
    // Obviously not all Emitters should be limited to 10. This function allows
    // that to be increased. Set to zero for unlimited.
    var defaultMaxListeners = 10;
    EventEmitter.prototype.setMaxListeners = function (n) {
        if (!this._events) this._events = {};
        this._maxListeners = n;
    };


    EventEmitter.prototype.emit = function () {
        var type = arguments[0];
        // If there is no 'error' event listener then throw.
        if (type === 'error') {
            if (!this._events || !this._events.error ||
                (isArray(this._events.error) && !this._events.error.length)) {
                if (this.domain) {
                    var er = arguments[1];
                    er.domain_emitter = this;
                    er.domain = this.domain;
                    er.domain_thrown = false;
                    this.domain.emit('error', er);
                    return false;
                }

                if (arguments[1] instanceof Error) {
                    throw arguments[1]; // Unhandled 'error' event
                } else {
                    throw new Error("Uncaught, unspecified 'error' event.");
                }
                return false;
            }
        }

        if (!this._events) return false;
        var handler = this._events[type];
        if (!handler) return false;

        if (typeof handler == 'function') {
            if (this.domain) {
                this.domain.enter();
            }
            switch (arguments.length) {
                // fast cases
                case 1:
                    handler.call(this);
                    break;
                case 2:
                    handler.call(this, arguments[1]);
                    break;
                case 3:
                    handler.call(this, arguments[1], arguments[2]);
                    break;
                // slower
                default:
                    var l = arguments.length;
                    var args = new Array(l - 1);
                    for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
                    handler.apply(this, args);
            }
            if (this.domain) {
                this.domain.exit();
            }
            return true;

        } else if (isArray(handler)) {
            if (this.domain) {
                this.domain.enter();
            }
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

            var listeners = handler.slice();
            for (var i = 0, l = listeners.length; i < l; i++) {
                listeners[i].apply(this, args);
            }
            if (this.domain) {
                this.domain.exit();
            }
            return true;

        } else {
            return false;
        }
    };

    EventEmitter.prototype.addListener = function (type, listener) {
        if ('function' !== typeof listener) {
            throw new Error('addListener only takes instances of Function');
        }

        if (!this._events) this._events = {};

        // To avoid recursion in the case that type == "newListeners"! Before
        // adding it to the listeners, first emit "newListeners".
        this.emit('newListener', type, typeof listener.listener === 'function' ?
            listener.listener : listener);

        if (!this._events[type]) {
            // Optimize the case of one listener. Don't need the extra array object.
            this._events[type] = listener;
        } else if (isArray(this._events[type])) {

            // If we've already got an array, just append.
            this._events[type].push(listener);

        } else {
            // Adding the second element, need to change to array.
            this._events[type] = [this._events[type], listener];

        }

        // Check for listener leak
        if (isArray(this._events[type]) && !this._events[type].warned) {
            var m;
            if (this._maxListeners !== undefined) {
                m = this._maxListeners;
            } else {
                m = defaultMaxListeners;
            }

            if (m && m > 0 && this._events[type].length > m) {
                this._events[type].warned = true;
                console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
                console.trace();
            }
        }

        return this;
    };

    EventEmitter.prototype.on = EventEmitter.prototype.addListener;

    EventEmitter.prototype.once = function (type, listener) {
        if ('function' !== typeof listener) {
            throw new Error('.once only takes instances of Function');
        }

        var self = this;

        function g() {
            self.removeListener(type, g);
            listener.apply(this, arguments);
        };

        g.listener = listener;
        self.on(type, g);

        return this;
    };

    EventEmitter.prototype.removeListener = function (type, listener) {
        if ('function' !== typeof listener) {
            throw new Error('removeListener only takes instances of Function');
        }

        // does not use listeners(), so no side effect of creating _events[type]
        if (!this._events || !this._events[type]) return this;

        var list = this._events[type];

        if (isArray(list)) {
            var position = -1;
            for (var i = 0, length = list.length; i < length; i++) {
                if (list[i] === listener ||
                    (list[i].listener && list[i].listener === listener)) {
                    position = i;
                    break;
                }
            }

            if (position < 0) return this;
            list.splice(position, 1);
        } else if (list === listener ||
            (list.listener && list.listener === listener)) {
            delete this._events[type];
        }

        return this;
    };

    EventEmitter.prototype.removeAllListeners = function (type) {
        if (arguments.length === 0) {
            this._events = {};
            return this;
        }

        var events = this._events && this._events[type];
        if (!events) return this;

        if (isArray(events)) {
            events.splice(0);
        } else {
            this._events[type] = null;
        }

        return this;
    };

    EventEmitter.prototype.listeners = function (type) {
        if (!this._events) this._events = {};
        if (!this._events[type]) this._events[type] = [];
        if (!isArray(this._events[type])) {
            this._events[type] = [this._events[type]];
        }
        return this._events[type];
    }
})('object' === typeof module ? module.exports : window, this);

(function (exports, GLOBAL) {
    exports.Protocol = exports.Protocol || require('pomelo-protocol');
}('object' === typeof module ? module.exports : window, this));

(function (exports, GLOBAL) {
    var Protocol = exports.Protocol;
    var Package = Protocol.Package;
    var Message = Protocol.Message;
    var decodeIO_encoder = null;
    var decodeIO_decoder = null;
    var JS_WS_CLIENT_TYPE = 'js-websocket';
    var JS_WS_CLIENT_VERSION = '0.0.1';
    var DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
    var gapThreshold = 100;   // heartbeat gap threashold
    var RES_OK = 200;
    var RES_FAIL = 500;
    var RES_OLD_CLIENT = 501;

    function pomelo() {

    }

    var root = exports;
    root.pomelo = pomelo;

    var OF = function () {
    };
    OF.prototype = root.EventEmitter.prototype;
    pomelo.prototype = new OF();

    pomelo.prototype.init = function (params, cb, errorCb) {
        var self = this;

        self.initCallback = cb;
        self.errorCallback = errorCb;
        self.callbacks = {};
        self.params = params;
        self.id = 1;
        self.dict = {};    // route string to code
        self.abbrs = {};   // code to route string
        //Map from id to route
        self.routeMap = {};
        self.reconnectAttempts = 0;
        self.reconnectionDelay = 5000;
        self.reconnect = false;
        self.reconncetTimer = null;
        self.maxReconnectAttempts = params.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS;
        self.heartbeatInterval = 0;
        self.heartbeatTimeout = 0;
        self.nextHeartbeatTimeout = 0;
        self.heartbeatTimeoutId = null;
        self.heartbeatId = null;
        self.handshakeBuffer = {
            'sys': {
                type: JS_WS_CLIENT_TYPE,
                version: JS_WS_CLIENT_VERSION
            },
            'deviceId': params.deviceId
        };

        self.handlers = {};
        self.handlers[Package.TYPE_HANDSHAKE] = self.handshake.bind(self);
        self.handlers[Package.TYPE_HEARTBEAT] = self.heartbeat.bind(self);
        self.handlers[Package.TYPE_DATA] = self.onMessage.bind(self);
        self.handlers[Package.TYPE_KICK] = self.onKick.bind(self);

        var host = params.host;
        var port = params.port;

        //Use HTTP Mode, do correspondent change in server side app.js
        //var url = 'http://' + host;
        self.url = 'ws://' + host;
        if (port) {
            self.url += ':' + port;
        }

        self.connect();
    };

    pomelo.prototype.connect = function () {
        var self = this;

        self.socket = new WebSocket(self.url, ['ws'], {binary: true});

        self.socket.on('open', function () {
            console.log('[pomeloclient.init] websocket connected!');

            if (!!self.reconnect) {
                self.emit('reconnect');
            }
            self.reset();
            if (self.socket) {
                self.socket.send(Package.encode(Package.TYPE_HANDSHAKE, Protocol.strencode(JSON.stringify(self.handshakeBuffer))), {binary: true}, function (err) {
                    if (!!err) {
                        console.log('websocket send handshake data failed: %j', err.stack);
                        return;
                    }
                });
            }
        });

        self.socket.on('message', function (data) {
            // new package arrived, update the heartbeat timeout
            if (self.heartbeatTimeout) {
                self.nextHeartbeatTimeout = Date.now() + self.heartbeatTimeout;
            }

            var msgs = Package.decode(data);

            if (Array.isArray(msgs)) {
                for (var i = 0; i < msgs.length; i++) {
                    var msg = msgs[i];
                    self.handlers[msg.type](msg.body);
                }
            } else {
                self.handlers[msgs.type](msgs.body);
            }
        });

        self.socket.on('error', function (err) {
            console.log(err);

            if (!self.doReconnect()) {
                self.errorCallback && self.errorCallback(err);
                self.errorCallback = null;
            }
        });

        self.socket.on('close', function () {
            self.emit('disconnect');

            self.doReconnect();
        });
    }

    pomelo.prototype.doReconnect = function () {
        var self = this;

        if (self.reconnectAttempts < self.maxReconnectAttempts) {
            self.reconnect = true;
            self.reconnectAttempts++;
            self.reconncetTimer = setTimeout(function () {
                self.connect();
            }, self.reconnectionDelay);
            self.reconnectionDelay *= 2;

            return true;
        }
    }

    pomelo.prototype.disconnect = function () {
        this.reset();

        if (this.heartbeatId) {
            clearTimeout(this.heartbeatId);
            this.heartbeatId = null;
        }
        if (this.heartbeatTimeoutId) {
            clearTimeout(this.heartbeatTimeoutId);
            this.heartbeatTimeoutId = null;
        }

        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    };

    pomelo.prototype.request = function (route) {
        if (!route) {
            return;
        }
        var msg = {};
        var cb;
        arguments = Array.prototype.slice.apply(arguments);
        if (arguments.length === 2) {
            if (typeof arguments[1] === 'function') {
                cb = arguments[1];
            } else if (typeof arguments[1] === 'object') {
                msg = arguments[1];
            }
        } else if (arguments.length === 3) {
            msg = arguments[1];
            cb = arguments[2];
        }

        if (route.indexOf('area.') === 0) {
            msg.areaId = this.areaId;
        }

        msg.timestamp = Date.now();

        this.id++;
        this.callbacks[this.id] = cb;
        this.routeMap[this.id] = route;
        this.send(this.id, route, msg);
    };

    pomelo.prototype.notify = function (route, msg) {
        this.send(0, route, msg);
    };

    pomelo.prototype.send = function (reqId, route, msg) {
        var self = this;

        msg = self.encode(reqId, route, msg);
        self.socket.send(Package.encode(Package.TYPE_DATA, msg), {binary: true}, function (err) {
            if (!!err) {
                console.log('websocket send binary data failed: %j', err.stack);
                return;
            }
        });
    }

    pomelo.prototype.encode = function (reqId, route, msg) {
        var self = this, type = reqId ? Message.TYPE_REQUEST : Message.TYPE_NOTIFY;

        var compressRoute = 0;
        if (self.dict && self.dict[route]) {
            route = self.dict[route];
            compressRoute = 1;
        }

        return Message.encode(reqId, type, compressRoute, route, Protocol.strencode(JSON.stringify(msg)));
    };

    //abbrs, routeMap
    pomelo.prototype.decode = function (data) {
        var self = this;

        function deCompose(msg) {
            var route = msg.route;

            //Decompose route from dict
            if (msg.compressRoute) {
                if (!self.abbrs[route]) {
                    return {};
                }

                route = msg.route = self.abbrs[route];
            }

            return JSON.parse(Protocol.strdecode(msg.body));
        };

        var msg = Message.decode(data);

        if (msg.id > 0) {
            msg.route = self.routeMap[msg.id];
            delete self.routeMap[msg.id];
            if (!msg.route) {
                return;
            }
        }

        msg.body = deCompose(msg);

        return msg;
    };

    pomelo.prototype.reset = function () {
        var self = this;

        self.reconnect = false;
        self.reconnectionDelay = 1000 * 5;
        self.reconnectAttempts = 0;
        self.reconncetTimer && clearTimeout(self.reconncetTimer);
    };

    pomelo.prototype.handshake = function (data) {
        var self = this;

        function handshakeInit(data) {
            if (data.sys && data.sys.heartbeat) {
                self.heartbeatInterval = data.sys.heartbeat * 1000;   // heartbeat interval
                self.heartbeatTimeout = self.heartbeatInterval * 2;        // max heartbeat timeout
            } else {
                self.heartbeatInterval = 0;
                self.heartbeatTimeout = 0;
            }

            if (data.sys && data.sys.dict) {
                self.dict = data.sys.dict;

                //Init compress dict
                if (self.dict) {
                    self.abbrs = {};

                    for (var route in self.dict) {
                        self.abbrs[self.dict[route]] = route;
                    }
                }
            }
        };

        data = JSON.parse(Protocol.strdecode(data));
        if (data.code === RES_OLD_CLIENT) {
            self.emit('error', 'client version not fullfill');
            self.errorCallback && self.errorCallback('handshake fail');
            self.errorCallback = null;
            return;
        }

        if (data.code !== RES_OK) {
            self.emit('error', 'handshake fail');
            self.errorCallback && self.errorCallback('handshake fail');
            self.errorCallback = null;
            return;
        }

        handshakeInit(data);

        self.socket.send(Package.encode(Package.TYPE_HANDSHAKE_ACK), {binary: true}, function (err) {
            if (!!err) {
                console.log('websocket send handshake ack data failed: %j', err.stack);
                self.errorCallback && self.errorCallback('websocket send handshake ack data failed');
                self.errorCallback = null;
            } else {
                if (self.initCallback) {
                    self.initCallback(self.socket);
                    self.initCallback = null;
                }
            }
        });
    };

    pomelo.prototype.heartbeat = function () {
        var self = this;

        function heartbeatTimeoutCb() {
            var gap = self.nextHeartbeatTimeout - Date.now();
            if (gap > gapThreshold) {
                self.heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb, gap);
            } else {
                console.error('server heartbeat timeout');
                self.emit('heartbeat timeout');
                self.disconnect();
            }
        };

        if (!self.heartbeatInterval) {
            // no heartbeat
            return;
        }

        if (self.heartbeatTimeoutId) {
            clearTimeout(self.heartbeatTimeoutId);
            self.heartbeatTimeoutId = null;
        }

        if (self.heartbeatId) {
            // already in a heartbeat interval
            return;
        }
        self.heartbeatId = setTimeout(function () {
            self.heartbeatId = null;

            if (self.socket) {
                self.socket.send(Package.encode(Package.TYPE_HEARTBEAT), {binary: true}, function (err) {
                    if (!!err) {
                        console.log('websocket send heartbeat data failed: %j', err.stack);
                        return;
                    }
                });
            }

            self.nextHeartbeatTimeout = Date.now() + self.heartbeatTimeout;
            self.heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb, self.heartbeatTimeout);
        }, self.heartbeatInterval);
    };

    pomelo.prototype.onMessage = function (data) {
        var msg = this.decode(data);
        processMessage(this, msg);
    };

    pomelo.prototype.onKick = function (data) {
        this.emit('onKick');
    };

    var processMessage = function (pomelo, msg) {
        var route;
        if (msg.id) {
            //if have a id then find the callback function with the request
            var cb = pomelo.callbacks[msg.id];

            delete pomelo.callbacks[msg.id];
            if (typeof cb !== 'function') {
                console.log('[pomeloclient.processMessage] cb is not a function for request ' + msg.id);
                return;
            }

            cb(msg.body);
            return;
        }

        // server push message or old format message
        processCall(msg);

        //if no id then it should be a server push message
        function processCall(msg) {
            var route = msg.route;
            if (!!route) {
                if (!!msg.body) {
                    var body = msg.body.body;
                    if (!body) {
                        body = msg.body;
                    }
                    pomelo.emit(route, body);
                } else {
                    pomelo.emit(route, msg);
                }
            } else {
                pomelo.emit(msg.body.route, msg.body);
            }
        }
    };

    var processMessageBatch = function (pomelo, msgs) {
        for (var i = 0, l = msgs.length; i < l; i++) {
            processMessage(pomelo, msgs[i]);
        }
    };
})('object' === typeof module ? module.exports : window, this);