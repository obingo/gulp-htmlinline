var gulp = require('gulp');
var htmlinline = require('../');
var through = require('through2');
var read = require('fs').readFileSync;

describe('htmlinline', function() {

  it('normal', function(done) {

    gulp
      .src('./test/fixtures/a.html')
      .pipe(htmlinline())
      .pipe(through.obj(function(file) {
        var expected = read('./test/fixtures/a-expected.html', 'utf-8');
        file.contents.toString().should.be.eql(expected);
        done();
      }));
  });
});
