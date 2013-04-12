var fs = require('fs'),
  path = require('path'),
  express = require('express'),
  temp = require('temp'),
  bower = require('bower'),
  crypto = require('crypto'),
  grunt = require('grunt'),
  Zip = require('express-zip');
  app = express();

grunt.task.loadNpmTasks('grunt-smush-components');

app.get('/', function(req, res){
  var log = [],
    dependencies = {};

  if (!req.query.packages || req.query.packages.length == 0){
    res.send('Package parameter is required.');
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
    if(!err){
      fs.chmodSync(tempLocation, "0755");
    }

    fs.writeFileSync(path.join(tempLocation, 'component.json'), JSON.stringify({
      name: 'temp-package',
      version: '0.0.0',
      dependencies: dependencies
    }));

    bower.commands.install([tempLocation], { config: { directory: componentsDir }})
      .on('data', function(data){
        console.log("Data:", data);
        log.push(data);
      })
      .on('end', function(data){

        if (!fs.existsSync(path.join(componentsDir, 'document.register'))) {
          res.send('Only X-Tag packages are supported.');
          res.end();
          return;
        }

        grunt.registerTask('smush','Combine the components', function(){
          grunt.initConfig({
            'smush-components': {
              options:{
                directory: componentsDir,
                fileMap: {
                  js: path.join(outputDir, 'x-tag-components.js'),
                  css: path.join(outputDir, 'x-tag-components.css')
                }
              }
            }
          });
          grunt.task.run('smush-components');
        });

        grunt.tasks(['smush'], {verbose: true}, function(){
          var logFile = path.join(outputDir,'log.txt');
          fs.writeFile(logFile, log.join('\n'), function(err){
            if (err) {
              res.send(err);
              res.end();
            } else {
              var files = [{ path: logFile, name: 'log.txt'}];
              fs.readdirSync(outputDir).forEach(function(file){
                files.push({ path: path.join(outputDir,file), name: file});
              });
              res.zip(files);
            }
          });
        });

      })
      .on('error', function(err){
        console.log('' + err);
        res.send('' + err);
        res.end();
      });
  });
});

app.listen(3000);