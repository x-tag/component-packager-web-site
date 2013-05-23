var fs = require('fs'),
  path = require('path'),
  rimraf = require('rimraf'),
  express = require('express'),
  bower = require('bower'),
  crypto = require('crypto'),
  grunt = require('grunt'),
  Zip = require('express-zip');
  app = express();

grunt.loadNpmTasks('grunt-smush-components');
grunt.loadNpmTasks('grunt-yui-compressor');
grunt.loadNpmTasks('grunt-contrib-uglify');

app.get('/', function(req, res){
  var dependencies = {};

  if (!req.query.packages || req.query.packages.length == 0){
    res.send('"packages" parameter is required.');
    res.end();
    return;
  }

  (req.query.packages || '').split(',').forEach(function(item){
    dependencies[item] = '*';
  });

  var localTemp = 'temp/' + crypto.randomBytes(4).readUInt32LE(0);
    tempLocation = path.join(__dirname, localTemp),
    componentsDir = path.join(localTemp, 'components'),
    outputDir = path.join(tempLocation, 'dist');

  fs.mkdir(tempLocation, function(err){
    if(err){
      res.send("There was an error processing this request.");
      res.end();
      return;
    }

    fs.chmodSync(tempLocation, "0755");
    fs.writeFileSync(path.join(tempLocation, 'component.json'), JSON.stringify({
      name: 'temp-package',
      version: '0.0.0',
      dependencies: dependencies
    }));

    bower.commands.install([tempLocation], { config: { directory: componentsDir }})
      .on('data', function(data){
        console.log("Data:", data);
      })
      .on('end', function(data){

        grunt.registerTask('smush','Combine the components', function(){
          var gruntInit = {
            'smush-components': {
              options:{
                directory: componentsDir,
                fileMap: {
                  js: path.join(outputDir, 'x-tag-components.js'),
                  css: path.join(outputDir, 'x-tag-components.css')
                }
              }
            },
            'uglify': {
              dist: {
                files: {}
              }
            },
            'cssmin': {
              dist: {
                src: [path.join(outputDir, 'x-tag-components.css')],
                dest: path.join(outputDir, 'x-tag-components.min.css')
              }
            }
          };
          gruntInit.uglify.dist.files[path.join(outputDir,'x-tag-components.min.js')]
            = [path.join(outputDir, 'x-tag-components.js')];
          grunt.initConfig(gruntInit);
        });

        grunt.tasks(['smush','smush-components','uglify:dist','cssmin:dist'], { verbose: true }, function(){
          var files = [];
          fs.readdirSync(outputDir).forEach(function(file){
            files.push({ path: path.join(outputDir,file), name: file});
          });
          res.zip(files, 'x-tag-components.zip');
        });

      })
      .on('error', function(err){
        console.log('' + err);
        res.send('' + err);
        res.end();
      });
  });
});

// Clean up temp files
function clearTempDir(){
  var tempDir = path.join(__dirname, 'temp');
  fs.readdir(tempDir, function(err, files){
    files.map(function (file) {
        return path.join(tempDir, file);
      }).filter(function(file){
        return fs.statSync(file).isDirectory();
      }).forEach(function(file){
        rimraf(file, function(err){
          console.log("removed temp directory:", file);
        });
      });
  });
}

clearTempDir();

var port = process.env.PORT || process.env.VCAP_APP_PORT || 3001;
console.log("Packager listening on port:", port)
app.listen(port);