'use strict';
var gutil = require('gulp-util');
var through = require('through2');
var phantom = require('phantom');
var http = require('http');
var st = require('st');

// Core screenshot function using phamtonJS
var browser = function (file, opts, cb) {
  var width = opts.width.slice(0);
  var height = opts.height.slice(0);
  var name = opts.name.slice(0);
  var filename = file.replace(opts.path, '').replace('\\','/');
  var url = opts.protocol + '://' +  opts.host + ':' + opts.port + '/' + filename;

  phantom.create(function (ph) {
    ph.createPage(function (page) {
      page.set('zoomFactor', opts.zoom);
      var screenshot = function (w,h,n) {
        if (!w) {
          ph.exit();
          setTimeout(cb, opts.timeout);
          width = opts.width * opts.zoom;
          return;
        }
        page.set('viewportSize', {
          width: w * opts.zoom,
          height: h * opts.zoom
        });

        page.open(url, function() {
          var dest;

          if ( opts.zoom > 1 ) {
            dest = filename.replace('.html', '') + '-' + n + '-zoom-' + opts.zoom + '.' + opts.type;
          } else {
            dest = filename.replace('.html', '') + '-' + n + '.' + opts.type;
          }
          
          // Background problem under self-host server
          page.evaluate(function () {
            var style = document.createElement('style');
            var text = document.createTextNode('body { background: #fff }');
            style.setAttribute('type', 'text/css');
            style.appendChild(text);
            document.head.insertBefore(style, document.head.firstChild);
          });
          setTimeout(function() {
             page.render(opts.folder + '/' + dest, function () {
               gutil.log('Screenshots:', dest + gutil.colors.green(' done'));
               screenshot(width.pop(),height.pop(),name.pop());
             });
          }, opts.delay);
        });
      };
      screenshot(width.pop(),height.pop(),name.pop());
    });
  }, {
  dnodeOpts: {
    weak: false
  }
});
};

module.exports = function (options) {
  var opts = {
    local: {}
  };
  var server;
  options = options ? options : {};

  //defaults
  opts.path = options.path || 'public/';
  opts.port = options.port || '8080';
  opts.width = options.width || ['1024'];
  opts.height = options.height || ['10'];
  opts.name = options.name || [''];
  opts.zoom = options.zoom || '1';
  opts.type = options.type || 'jpg';
  opts.folder = options.folder || 'screens';
  opts.timeout = options.timeout || 200;
  opts.delay = options.delay || 0;
  opts.protocol = options.protocol || 'http';
  opts.host = options.host || 'localhost';
  opts.server = typeof options.server === 'undefined' ? true : options.server;

  //start local webserver
  if (opts.server) {
    server = http.createServer(st({ path: opts.path })).listen(opts.port);
  }

  return through.obj(function (file, enc, cb) {
    if (file.isNull()) {
      this.push(file);
      return cb();
    }

    if (file.isStream()) {
      this.emit('error', new gutil.PluginError('gulp-local-screenshots-for-windows: ', 'Streaming not supported'));
      return cb();
    }

    this.push(file);
    browser(file.relative, opts, cb);

  }, function (cb) {
    if (opts.server) {
      server.close();
    }
    cb();
  });
};
