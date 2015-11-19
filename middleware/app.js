var fs = require('fs');
var pomelo = require('pomelo');

/**
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'sirius');

app.set('chatRoute', 'SIRIUS_CHAT_ROUTE');
app.set('loginChannel', 'SIRIUS_LOGIN_CHANNEL');

app.set('inviteSignal', 1001);
app.set('connectSignal', 1002);
app.set('disconnectSignal', 1003);
app.set('pauseSignal', 1004);
app.set('resumeSignal', 1005);
app.set('messageSignal', 1006);

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
app.set('chatDestroyState', 3);

app.set('topicOpenState', 11);
app.set('topicPauseState', 12);
app.set('topicDestroyState', 13);

// app configuration
app.configure('production|development', 'chat', function () {
    app.set('connectorConfig',
        {
            connector: pomelo.connectors.sioconnector,
            heartbeat : 3
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