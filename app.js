'use strict';
var http = require('http');
var path = require('path');
var _ = require('lodash');
var fs = require('fs');
var co = require('co');
var browserify = require('browserify');
var watchify = require('watchify');
var UglifyJs = require('uglify-js');
global.Promise = require('bluebird');
var env = process.env.NODE_ENV || 'development';
var ON_PRODUCTION = env === 'production';

var server = http.createServer();

var getClientSource = cachePromise(function (resolve, reject) {
    fs.readFile(path.join(__dirname, 'client.html'), 'utf-8',
        function (err, content) {
            if (err) return reject(err);
            resolve(content);
        });
});

var getClientScript = cachePromise(function (resolve, reject) {
    //var br = ON_PRODUCTION ? browserify : watchify;
    var b = browserify(_.assign({
        basedir: __dirname
    }, watchify.args));
    b.add('./browser.js');
    if (!ON_PRODUCTION) b = watchify(b);
    b.bundle(function (err, source) {
        if (err) return reject(err);
        source = source.toString('utf-8');
        if (ON_PRODUCTION) {
            try {
                source = UglifyJs.minify(source, {
                    fromString: true
                }).code;
            } catch (e) {
                return reject(e);
            }
            resolve(source);
        } else {
            resolve(source);
        }
    });
});

function cachePromise(fn) {
    var cache;

    function np() {
        return new Promise(fn);
    }
    if (ON_PRODUCTION) {
        return function () {
            return cache ? cache : (cache = np());
        }
    } else {
        return function () {
            return np();
        }
    }
};

server.on('request', co.wrap(function * (req, res) {
    req.url = req.url.replace(/\/+/g, '/');
    if (req.url.indexOf('/browser.js') === 0) {
        res.setHeader('Content-Type',
            'application/javascript; charset=utf-8');
        return res.end(yield getClientScript());
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(yield getClientSource());
}));

server.listen(28693);
