const shell = require('shelljs');
shell.echo(shell.pwd());
shell.echo('Building Doom Directory');
shell.mkdir('-p', 'bin/Ego Manager-win32-x64/idTech/sourceports', 'bin/Ego Manager-win32-x64/idTech/iwads', 'bin/Ego Manager-win32-x64/idTech/pwads');
shell.cp('./commandLineOptions.json', 'bin/Ego Manager-win32-x64/');
shell.cp('./DMFlags.json', 'bin/Ego Manager-win32-x64/');
shell.cp('./Levels.json', 'bin/Ego Manager-win32-x64/');