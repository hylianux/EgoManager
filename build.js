const shell = require('shelljs');
const exportDir = './dist/resources/app/';
shell.echo(shell.pwd());
shell.echo('making build directory');

//shell.mkdir('-p', exportDir, './dist/idTech/sourceports/GZDoom', './dist/idTech/iwads', './dist/idTech/pwads');
shell.mkdir('-p', exportDir, './dist/idTech/');
//shell.touch('./dist/idTech/sourceports/GZDoom/gzdoom.exe', './dist/idTech/iwads/doom.wad', './dist/idTech/pwads/mod.wad', './dist/idTech/pwads/otherMod.ipk3', './dist/idTech/pwads/otherModForReal.pk3', './dist/idTech/sourceports/GZDoom/default-config.ini');
shell.echo('copying src files into build directory');
shell.cp('-r', './src/*', exportDir);
shell.echo('copying package.json files into build directory');
shell.cp('./package*.json', exportDir);
shell.cp('-Rf', './testData/*', './dist/idTech/');