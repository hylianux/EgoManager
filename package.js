const sevenBin = require('7zip-bin').path7za;
const _7z = require('node-7z');

console.log('Building 7z file... please wait, this part takes a while for some crazy reason');

const myStream = _7z.add('EgoManager.7z', './bin/Ego Manager-win32-x64/*', {
    recursive : true,
    $bin: sevenBin,
    $progress: true
});
