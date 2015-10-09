var fs = require('fs');
var pomelo = require('pomelo');

/**
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'sirius');

// app configuration
app.configure('production|development', function(){
  app.set('connectorConfig',
    {
      connector : pomelo.connectors.sioconnector,
      key: fs.readFileSync('../shared/server.key'),
  		cert: fs.readFileSync('../shared/server.crt')
    });
});

// start app
app.start();

process.on('uncaughtException', function (err) {
  console.error(' Caught exception: ' + err.stack);
});