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