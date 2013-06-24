
/**
 * 程序入口, 主模块
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');

var app = express();

app.configure(function () {
	app.set('port', process.env.PORT || 3000);
	app.set('views', __dirname + '/views');
	app.set('view engine', 'ejs');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.cookieParser('your secret here'));
	app.use(express.session());
	app.use(app.router);
	app.use(require('less-middleware')({
		src: __dirname + '\\static', // ATTENTIONS: 如果不在Windows环境下运行请改成正斜杠'/'!
		compress: true
    }));
	app.use(express.static(path.join(__dirname, 'static')));
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

app.get('/', routes.index);

app.post('/', function(req, res){
	console.log('Index: ' + req.body.index + ' - Recieved');
	var delayTime = Math.random() * 5000 + 1000;
	setTimeout(function () {
		res.send(req.body);
		console.log('Index: ' + req.body.index + ' - Sent (delay: ' + delayTime + 'ms)');
	}, delayTime);
});

http.createServer(app).listen(app.get('port'), function () {
	console.log("Express server listening on port " + app.get('port'));
});
