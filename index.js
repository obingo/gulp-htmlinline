var through = require('through2');
var $ = require('cheerio');
var EventProxy = require('eventproxy');
var request = require('request');
var format = require('util').format;
var dirname = require('path').dirname;
var join = require('path').join;
var read = require('fs').readFileSync;
var uglify = require('uglify-js');
var cleanCss = require('clean-css');

var REG_LINK_STYLESHEET = /<link.+rel=('|")?stylesheet('|")?.+\/?>/gi;
var REG_EXTERNAL_SCRIPT = /<script.+src=.+><\/script>/gi;

module.exports = function(options) {
  options = options || {};

  if (typeof options === 'string') {
    options = { flag: options };
  }

  var flag = options.flag || 'inline';

  if (options.js) {
    options.js.fromString = true;
  } else {
    options.js = {fromString: true};
  }

  return through.obj(function(file, enc, callback) {
    var html = file.contents.toString();
    var basedir = dirname(file.path);
    var remotes = [];

    function compressContent (type, content) {
      try {
        content = (type === 'css')
            ? new cleanCss(options.css).minify(content)
            : uglify.minify(content, options.js).code;
      } catch (err) { /* return uncompressed if error */ }

      return content;
    }

    function getContent(url) {
      var isRemote = /^https?:\/\//.test(url);
      var content;
      if (isRemote) {
        content = addNoise(url);
        remotes.push(content);
      } else {
        content = read(join(basedir, url), 'utf-8');
      }
      return content;
    }

    function addNoise(url) {
      return '__' + url + '__';
    }

    function removeNoise(url) {
      return url.replace(/__/g, '');
    }

    function done() {
      file.contents = new Buffer(html);
      callback(null, file);
    }

    // inline css
    html = html.replace(REG_LINK_STYLESHEET, function(text) {
      var el = $('link', text);
      if (el.attr(flag) !== undefined && el.attr('href')) {
        var content = getContent(el.attr('href'));
        if (options.compress) content = compressContent('css', content);
        return format('<style>%s</style>', content);
      }
      return text;
    });

    // inline js
    html = html.replace(REG_EXTERNAL_SCRIPT, function(text) {
      var el = $('script', text);
      if (el.attr(flag) !== undefined && el.attr('src')) {
        var content = getContent(el.attr('src'));
        if (options.compress) content = compressContent('js', content);
        return format('<script>%s</script>', content);
      }
      return text;
    });

    // replace remote assets
    if (!remotes.length) {
      return done();
    }

    var ep = new EventProxy();
    ep.after('fetch', remotes.length, function() {
      done();
    });
    remotes.forEach(function(url) {
      request(removeNoise(url), function(err, res, body) {
        if (err || res.statusCode !== 200) {
          console.error('remote fetch error: [%s] %s', res.statusCode, err);
        } else {
          html = html.replace(url, body);
        }
        ep.emit('fetch');
      });
    });
  });
};
