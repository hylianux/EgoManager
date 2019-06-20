'use strict';
const ko = require('knockout');
const path = require('path');
const fs = require('fs');
const titlebar = require('custom-electron-titlebar');
const Loki = require('lokijs');
const _ = require('lodash');
const pwadTypes = ['wad', 'pk3', 'deh', 'bex'];
const iwadTypes = ['wad', 'pk3'];
// Importing this adds a right-click menu with 'Inspect Element' option
const { remote } = require('electron');
const { Menu, MenuItem } = remote;
let args = require('minimist')(remote.process.argv);
let dev = args.dev || args.d;
let rightClickPosition = null;

const menu = new Menu();
const menuItem = new MenuItem({
    label: 'Inspect Element',
    click: () => {
        remote.getCurrentWindow().inspectElement(rightClickPosition.x, rightClickPosition.y);
    }
});
menu.append(menuItem);

if (dev) {
    window.addEventListener(
        'contextmenu',
        e => {
            e.preventDefault();
            rightClickPosition = { x: e.x, y: e.y };
            menu.popup(remote.getCurrentWindow());
        },
        false
    );
}

function getCollection(collectionName) {
    let collection = db.getCollection(collectionName);
    if (!collection) {
        collection = db.addCollection(collectionName);
    }
    return collection;
}

//TODO: CHOCOLATE DOOM multi-screen command
//chocolate-doom -server -window & chocolate-doom -autojoin -left -window & chocolate-doom -autojoin -right -window

//TODO: Add command logic for moving to chosen levels
/**
 * 
    {
        "command": "-warp",
        "value": "1 1" or "1",
        have it lookup from the Levels collection.
    }
 */

//TODO: create custom commands for WAD merging in chocolate doom

let db = new Loki(path.resolve(__dirname, '../../ego.json'), {
    autosave: true,
    env: 'NODEJS'
});
let iwadCollection = getCollection('iwads');
let pwadCollection = getCollection('pwads');
let sourceportCollection = getCollection('sourceports');
let configCollection = getCollection('configs');
let commandLineCollection = getCollection('commands');
let DMFlagsCollection = getCollection('DMFlags');
let levelsCollection = getCollection('levels');

fs.readFile(path.resolve(__dirname, '../../commandLineOptions.json'), 'utf8', (err, data) => {
    if (err) {
        console.log('file read error!' + err);
    } else {
        let commands = JSON.parse(data);
        /*
        if (dev) {
            console.log('buildIwad:: adding ' + fullPath);
            console.log('reloadFiles: ' + reloadFiles);
        }*/
        _.forEach(commands, command => {
            upsert(commandLineCollection, ['name', 'command', 'sourceports'], command);
        });
    }
});
fs.readFile(path.resolve(__dirname, '../../DMFlags.json'), 'utf8', (err, data) => {
    if (err) {
        console.log('file read error!' + err);
    } else {
        let flags = JSON.parse(data);
        /*
        if (dev) {
            console.log('buildIwad:: adding ' + fullPath);
            console.log('reloadFiles: ' + reloadFiles);
        }*/
        _.forEach(flags, flag => {
            upsert(DMFlagsCollection, ['name', 'value', 'command', 'sourceport'], flag);
        });
    }
});
fs.readFile(path.resolve(__dirname, '../../Levels.json'), 'utf8', (err, data) => {
    if (err) {
        console.log('file read error!' + err);
    } else {
        let levels = JSON.parse(data);
        /*
        if (dev) {
            console.log('buildIwad:: adding ' + fullPath);
            console.log('reloadFiles: ' + reloadFiles);
        }*/
        _.forEach(levels, level => {
            upsert(levelsCollection, 'name', level);
        });
    }
});

/**
 * Performs an upsert.
 * This means performing an update if the record exists, or performing an
 * insert if it doesn't.
 * LokiJS (as at version 1.2.5) lacks this function.
 * TODO: Remove this function when LokiJS has built-in support for upserts.
 * @param {object} collection - The target DB collection.
 * @param {string} idQuery - The field(s) which contains the record's unique ID.
 * @param {object} record - The record to be upserted.
 * @depends lodash
 */
function upsert(collection, idQuery, record) {
    let query = {};
    if (typeof idQuery === 'string') {
        query[idQuery] = record[idQuery];
    } else if (Array.isArray(idQuery)) {
        _.forEach(idQuery, field => {
            query[field] = record[field];
        });
    }
    let existingRecord = collection.findOne(query);
    if (existingRecord) {
        // The record exists. Do an update.
        let updatedRecord = existingRecord;
        // Only update the fields contained in `record`. All fields not contained
        // in `record` remain unchanged.
        _.forEach(record, (value, key) => {
            updatedRecord[key] = value;
        });
        collection.update(updatedRecord);
    } else {
        // The record doesn't exist. Do an insert.
        collection.insert(record);
    }
}

function ConfigChain(
    configName,
    configDescription,
    sourceport,
    iniFile,
    iwad,
    gamemode,
    map,
    skill,
    pwads,
    dmFlags,
    sourceportConfigs
) {
    let self = this;
    self.configName = ko.observable(configName);
    self.configDescription = ko.observable(configDescription);
    self.sourceport = ko.observable();
    if (sourceport) {
        if (typeof sourceport === 'function') {
            self.sourceport = sourceport;
        } else if (typeof sourceport === 'object') {
            self.sourceport(
                new File(
                    sourceport.filepath,
                    sourceport.filename,
                    sourceport.authors,
                    sourceport.metaInput,
                    sourceport.source,
                    sourceport.name,
                    sourceport.quickDescription,
                    sourceport.longDescription,
                    sourceport.type,
                    sourceport.hidden,
                    sourceport.subtype
                )
            );
        }
    }
    self.chosenIniFile = ko.observable();
    if (iniFile) {
        if (typeof iniFile === 'function') {
            self.chosenIniFile = iniFile;
        } else if (typeof iniFile === 'object') {
            self.chosenIniFile(new IniFile(inifile.filepath, inifile.filename));
        }
    }

    self.iwad = ko.observable();
    if (iwad) {
        if (typeof iwad === 'function') {
            self.iwad = iwad;
        } else if (typeof iwad === 'object') {
            self.iwad(
                new File(
                    iwad.filepath,
                    iwad.filename,
                    iwad.authors,
                    iwad.metaTags,
                    iwad.source,
                    iwad.name,
                    iwad.quickDescription,
                    iwad.longDescription,
                    iwad.type,
                    iwad.hidden,
                    iwad.subtype
                )
            );
        }
    }
    self.gamemode = ko.observable(gamemode);
    self.map = ko.observable(map);
    self.skill = ko.observable(skill);
    self.dmFlags = ko.observableArray();
    if (dmFlags) {
        _.foreach(dmFlags, dmflag => {
            let newDMFlag = new DMFlag(
                dmflag.enabled,
                dmflag.name,
                dmflag.value,
                dmflag.description,
                dmflag.command,
                dmflag.sourceport
            );
            self.dmFlags.push(newDMFlag);
        });
    }
    self.pwads = ko.observableArray();
    if (pwads) {
        _.forEach(pwads, pwad => {
            let newPWad = new File(
                pwad.filepath,
                pwad.filename,
                pwad.author,
                pwad.metaTags,
                pwad.source,
                pwad.name,
                pwad.quickDescription,
                pwad.longDescription,
                pwad.type,
                pwad.hidden,
                pwad.subtype
            );
            self.pwads.push(newPWad);
        });
    }
    self.sourceportConfigs = ko.observableArray();
    if (sourceportConfigs) {
        _.foreach(sourceportConfigs, command => {
            let newCommand = new CommandLineOption(
                command.enabled,
                command.name,
                command.inputType,
                command.description,
                command.command,
                command.value,
                command.sourceports,
                command.category,
                command.valueExtra
            );
            self.sourceportConfigs.push(newCommand);
        });
    }

    //this will be generated from the current config chain
    self.generatedCommand = ko.computed(() => {
        let command = '';
        if (self.sourceport()) {
            command += self.sourceport().filename + ' ';
        }
        if (self.iwad()) {
            command += '-iwad ' + self.iwad().filename + ' ';
        }
        if (self.chosenIniFile()) {
            command += '-config ' + self.chosenIniFile().filename + ' ';
        }
        return command;
    });
}

function DMFlag(enabled, name, value, description, command, sourceport) {
    let self = this;
    self.enabled = ko.observable(enabled);
    self.name = name;
    self.value = value;
    self.description = description;
    self.command = command;
    self.sourceport = sourceport;
}

function CommandLineOption(enabled, name, inputType, description, command, value, sourceports, category, valueExtra) {
    let self = this;
    self.name = name;
    self.inputType = inputType;
    self.description = description;
    self.command = command;
    self.value = ko.observable(value);
    self.enabled = ko.observable(enabled);
    self.sourceports = sourceports;
    self.category = category;
    if (Array.isArray(valueExtra)) {
        self.valueset = valueExtra;
    } else self.valueRange = valueExtra;
}

function File(
    filepath,
    filename,
    authors,
    metaTags,
    source,
    name,
    quickDescription,
    longDescription,
    type,
    hidden,
    subtype
) {
    let self = this;
    self.filepath = filepath;
    self.filename = filename;
    self.authors = ko.observableArray(authors);
    self.authorsValid = ko.computed(() => {
        let valid = false;
        if (self.authors()) {
            valid = true;
        }
        if (valid) {
            valid = self.authors().length > 0;
        }
        if (valid) {
            valid = self.authors()[0].trim() != '';
        }
        return valid;
    });
    self.authorInput = ko.computed({
        read: () => {
            return self.authors().join(', ');
        },
        write: value => {
            self.authors(
                value.split(',').map(s => {
                    return String.prototype.trim.apply(s);
                })
            );
        },
        owner: self
    });
    self.metaTags = ko.observableArray(metaTags);
    self.metaTagsValid = ko.computed(() => {
        let valid = false;
        if (self.metaTags()) {
            valid = true;
        }
        if (valid) {
            valid = self.metaTags().length > 0;
        }
        if (valid) {
            valid = self.metaTags()[0].trim() != '';
        }
        return valid;
    });
    self.metaInput = ko.computed({
        read: () => {
            return self.metaTags().join(', ');
        },
        write: value => {
            self.metaTags(
                value.split(',').map(s => {
                    return String.prototype.trim.apply(s);
                })
            );
        },
        owner: self
    });
    self.source = ko.observable(source);
    self.sourceValid = ko.computed(() => {
        return self.source() && self.source().length > 0;
    });
    self.name = ko.observable(name);
    self.nameValid = ko.computed(() => {
        return self.name() && self.name().length > 0;
    });
    self.quickDescription = ko.observable(quickDescription);
    self.quickDescriptionValid = ko.computed(() => {
        return self.quickDescription() && self.quickDescription().length > 0;
    });
    self.longDescription = ko.observable(longDescription);
    self.type = ko.observable(type);
    self.typeValid = ko.computed(() => {
        return (
            self.type() &&
            self.type().length > 0 &&
            (self.type() === 'iwad' || self.type() === 'sourceport' || self.type() === 'pwad')
        );
    });
    self.hidden = ko.observable(false);
    if (hidden === true) {
        self.hidden(true);
    }
    self.subtype = ko.observable(subtype);

    self.hideFile = () => {
        let isHidden = self.hidden();
        self.hidden(!isHidden);
    };

    self.error = ko.computed(() => {
        return !self.authorsValid() || !self.sourceValid() || !self.typeValid();
    });
    self.warning = ko.computed(() => {
        return !self.metaTagsValid() || !self.nameValid() || !self.quickDescriptionValid();
    });
    self.displayName = ko.computed(() => {
        let displayname = '';
        if (!self.name()) {
            if (!self.filename) {
                displayname = '';
            } else {
                displayname = self.filename;
            }
        } else {
            displayname = self.name();
        }
        if (self.hidden()) {
            displayname = '(hidden) ' + displayname;
        }
        return displayname;
    });
    self.displayClass = ko.computed(() => {
        let displayClass = '';
        if (self.error()) {
            displayClass = 'table-danger';
        } else if (self.warning()) {
            displayClass = 'table-warning';
        } else {
            displayClass = '';
        }
        if (self.hidden()) {
            displayClass += ' font-italic';
        }
        return displayClass;
    });
    self.hideFileClass = ko.computed(() => {
        if (self.hidden() === true) {
            return 'fa fa-eye';
        } else {
            return 'fa fa-eye-slash';
        }
    });
    self.hideTooltipText = ko.computed(() => {
        if (self.hidden()) {
            return 'Show File';
        } else {
            return 'Hide File';
        }
    });
    self.tooltipText = ko.computed(() => {
        let text = '';
        let addNewline = false;
        if (self.error() || self.warning()) {
            if (!self.nameValid()) {
                text += addNewline ? ' <br> ' : '';
                text += 'Missing Name/Title';
                addNewline = true;
            }
            if (!self.authorsValid()) {
                text += addNewline ? ' <br> ' : '';
                text += 'Missing Authors';
                addNewline = true;
            }
            if (!self.metaTagsValid()) {
                text += addNewline ? ' <br> ' : '';
                text += 'Missing Meta Tags';
                addNewline = true;
            }
            if (!self.sourceValid()) {
                text += addNewline ? ' <br> ' : '';
                text += 'Missing Source';
                addNewline = true;
            }
            if (!self.quickDescriptionValid()) {
                text += addNewline ? ' <br> ' : '';
                text += 'Missing Description';
                addNewline = true;
            }
        } else {
            text += self.quickDescription();
        }
        return text;
    });
}

function IniFile(filepath, filename) {
    let self = this;
    self.filepath = filepath;
    self.filename = filename;
}

function AppViewModel() {
    let self = this;
    self.isDebug = dev;
    self.nodeVersion = process.versions.node;
    self.chromeVersion = process.versions.chrome;
    self.electronVersion = process.versions.electron;
    self.idTechFolder = path.resolve(__dirname, '../../idTech');
    self.iwadDirectory = self.idTechFolder + path.sep + 'iwads';
    self.pwadDirectory = self.idTechFolder + path.sep + 'pwads';
    self.sourceportDirectory = self.idTechFolder + path.sep + 'sourceports';

    self.sourceportTypes = ko.observableArray(['ZDoom', 'Zandronum', 'Chocolate', 'Other']);
    self.gamemodes = ko.observableArray([
        {
            value: 'solo',
            displayText: 'Solo'
        },
        {
            value: 'solonet',
            displayText: 'Solo-Net'
        },
        {
            value: 'coop',
            displayText: 'Co-op'
        },
        {
            value: 'dm',
            displayText: 'Deathmatch'
        }
    ]);
    self.iwadTypes = ko.observableArray([
        {
            name: 'doom',
            description: 'Doom'
        },
        {
            name: 'doom2',
            description: 'Doom2'
        },
        {
            name: 'hexen',
            description: 'Hexen: Beyond Heretic'
        },
        {
            name: 'hexend',
            description: 'Hexen: Deathkings of the Dark Citadel'
        },
        {
            name: 'strife',
            description: 'Strife'
        },
        {
            name: 'hacx',
            description: 'Hacx'
        },
        {
            name: 'tnt',
            description: 'TNT: Evilution'
        },
        {
            name: 'plutonia',
            description: 'The Plutonia experiment'
        },
        {
            name: 'nerve',
            description: 'No Rest for the Living'
        },
        {
            name: 'heretic',
            description: 'Heretic'
        },
        {
            name: 'chex',
            description: 'Chex Quest'
        },
        {
            name: 'other',
            description: 'Other'
        }
    ]);

    self.showHiddenFiles = ko.observable(false);

    self.Allfiles = ko.observableArray();
    self.files = {
        iwads: ko.observableArray(),
        pwads: ko.observableArray(),
        sourceports: ko.observableArray()
    };
    self.iwadsAllHidden = ko.computed(() => {
        let counter = 0;
        _.forEach(self.files.iwads(), iwad => {
            if (iwad.hidden() === true) {
                counter++;
            }
        });
        return counter === self.files.iwads.length;
    });
    self.pwadsAllHidden = ko.computed(() => {
        let counter = 0;
        _.forEach(self.files.pwads(), pwad => {
            if (pwad.hidden() === true) {
                counter++;
            }
        });
        return counter === self.files.pwads.length;
    });
    self.sourceportsAllHidden = ko.computed(() => {
        let counter = 0;
        _.forEach(self.files.sourceports(), sourceport => {
            if (sourceport.hidden() === true) {
                counter++;
            }
        });
        return counter === self.files.sourceports.length;
    });
    self.chosenFileType = ko.observable('');
    self.chosenFileIndex = ko.observable('');
    self.chosenFile = ko.computed(() => {
        switch (self.chosenFileType()) {
            case 'iwad':
                return self.files.iwads()[self.chosenFileIndex()];
            case 'pwad':
                return self.files.pwads()[self.chosenFileIndex()];
            case 'sourceport':
                return self.files.sourceports()[self.chosenFileIndex()];
        }
    });
    self.loadCollections = reloadFiles => {
        self.buildIwadCollection(reloadFiles);
        self.buildPwadCollection(reloadFiles);
        self.buildSourceportCollection(reloadFiles);
    };
    self.editFile = (type, index) => {
        self.chosenFileType(type());
        self.chosenFileIndex(index());
    };
    self.clearFileEdit = () => {
        self.chosenFileType('');
        self.chosenFileIndex('');
    };
    self.getFile = () => {
        switch (self.chosenFileType()) {
            case 'iwad':
                return self.iwads()[self.chosenFileIndex()];
            case 'pwad':
                return self.pwads()[self.chosenFileIndex()];
            case 'sourceport':
                return self.sourceports()[self.chosenFileIndex()];
        }
    };
    self.updateFile = file => {
        let rawFileProperties = {
            filename: file.filename,
            authors: file.authors(),
            metaTags: file.metaTags(),
            source: file.source(),
            name: file.name(),
            quickDescription: file.quickDescription(),
            longDescription: file.longDescription(),
            hidden: file.hidden(),
            subtype: file.subtype()
        };
        let directory = '';
        switch (file.type()) {
            case 'iwad':
                directory = self.iwadDirectory;
                break;
            case 'pwad':
                directory = self.pwadDirectory;
                break;
            case 'sourceport':
                directory = self.sourceportDirectory;
                break;
        }
        let RealFilename = file.filename.substring(0, file.filename.lastIndexOf('.'));
        fs.writeFile(path.resolve(directory, RealFilename + '.json'), JSON.stringify(rawFileProperties), err => {
            if (err) {
                return console.log(err);
            }
            switch (file.type()) {
                case 'iwad':
                    self.buildIwadCollection();
                    break;
                case 'pwad':
                    self.buildPwadCollection();
                    break;
                case 'sourceport':
                    self.buildSourceportCollection();
                    break;
            }
        });
    };
    self.loadIwadFiles = () => {
        let allIwads = iwadCollection.find();
        let newIwads = [];
        _.forEach(allIwads, iwad => {
            let newIwad = new File(
                iwad.filepath,
                iwad.filename,
                iwad.authors,
                iwad.metaTags,
                iwad.source,
                iwad.name,
                iwad.quickDescription,
                iwad.longDescription,
                'iwad',
                iwad.hidden,
                iwad.subtype
            );
            newIwads.push(newIwad);
        });
        self.files.iwads.removeAll();
        self.files.iwads.push.apply(self.files.iwads, newIwads);
    };

    self.loadPwadFiles = () => {
        let allPwads = pwadCollection.find();
        let newPwads = [];
        _.forEach(allPwads, pwad => {
            let newPwad = new File(
                pwad.filepath,
                pwad.filename,
                pwad.authors,
                pwad.metaTags,
                pwad.source,
                pwad.name,
                pwad.quickDescription,
                pwad.longDescription,
                'pwad',
                pwad.hidden
            );
            newPwads.push(newPwad);
        });
        self.files.pwads.removeAll();
        self.files.pwads.push.apply(self.files.pwads, newPwads);
    };
    self.loadSourceportFiles = () => {
        let allSourceports = sourceportCollection.find();
        let newSourceports = [];
        _.forEach(allSourceports, sourceport => {
            let newSourceport = new File(
                sourceport.filepath,
                sourceport.filename,
                sourceport.authors,
                sourceport.metaTags,
                sourceport.source,
                sourceport.name,
                sourceport.quickDescription,
                sourceport.longDescription,
                'sourceport',
                sourceport.hidden,
                sourceport.subtype
            );
            newSourceports.push(newSourceport);
        });
        self.files.sourceports.removeAll();
        self.files.sourceports.push.apply(self.files.sourceports, newSourceports);
    };
    self.iniFiles = ko.observableArray();

    self.chooseSourceport = (sourceport) => {
        if (sourceport){
            self.getIniFilesForGivenSourceport(sourceport);
        } else {
            self.iniFiles.removeAll();
        }
    };

    self.getIniFilesForGivenSourceport = (sourceport) => {
        let directory = path.dirname(sourceport.filepath);
        self.iniFiles.removeAll();
        function walk(directory) {
            fs.readdir(directory, (e, files) => {
                if (e) {
                    console.log('Error: ', e);
                    return;
                }
                files.forEach(
                    file => {
                        let fullPath = path.join(directory, file);
                        fs.stat(fullPath, (e, f) => {
                            if (e) {
                                console.log('Error: ', e);
                                return;
                            }
                            if (f.isDirectory()) {
                                if (dev) {
                                    console.log(
                                        'getIniFilesForGivenSourceport:: ' + file + ' and is directory: ' + fullPath
                                    );
                                }
                                // walk(fullPath); no need to dive into further directories, if your ini file isn't in 
                                //the same directory as the exe, then I don't care about it.
                            } else {
                                let fileExt = file.substring(file.lastIndexOf('.') + 1);

                                if (fileExt === 'ini') {
                                    let iniFile = new IniFile(fullPath, file);
                                    self.iniFiles.push(iniFile);
                                    self.iniFiles.sort();
                                }
                            }
                        });
                    },
                    err => {
                        if (err) {
                            throw err;
                        }
                    }
                );
            });
        }
        walk(directory);
    };

    self.buildIwadCollection = reloadFiles => {
        let directoryName = self.iwadDirectory;
        function walk(directory) {
            fs.readdir(directory, (e, files) => {
                if (e) {
                    console.log('Error: ', e);
                    return;
                }
                files.forEach(
                    file => {
                        let fullPath = path.join(directory, file);
                        fs.stat(fullPath, (e, f) => {
                            if (e) {
                                console.log('Error: ', e);
                                return;
                            }
                            if (f.isDirectory()) {
                                if (dev) {
                                    console.log('buildIwad:: ' + file + ' and is directory: ' + fullPath);
                                }
                                walk(fullPath);
                            } else {
                                let fileExt = file.substring(file.lastIndexOf('.') + 1);

                                if (iwadTypes.indexOf(fileExt) > -1) {
                                    let iwad = {
                                        filename: file,
                                        filepath: fullPath
                                    };
                                    if (dev) {
                                        console.log('buildIwad:: adding ' + fullPath);
                                        console.log('reloadFiles: ' + reloadFiles);
                                    }
                                    upsert(iwadCollection, 'filename', iwad);
                                    if (reloadFiles) {
                                        self.loadIwadFiles();
                                    }
                                } else if (fileExt === 'json') {
                                    fs.readFile(fullPath, 'utf8', (err, data) => {
                                        if (err) {
                                            console.log('file read error!' + err);
                                        } else {
                                            let iwad = JSON.parse(data);
                                            iwad.filepath = fullPath;
                                            if (dev) {
                                                console.log('buildIwad:: adding ' + fullPath);
                                                console.log('reloadFiles: ' + reloadFiles);
                                            }
                                            upsert(iwadCollection, 'filename', iwad);
                                            if (reloadFiles) {
                                                self.loadIwadFiles();
                                            }
                                        }
                                    });
                                } else if (fileExt === 'txt') {
                                    let iwad = iwadCollection.find({ filename: f })[0];
                                    fs.readFile(fullPath, 'utf8', (err, data) => {
                                        if (err) {
                                            console.log('file read error!' + err);
                                        } else {
                                            let longDescription = data;
                                            if (iwad && longDescription !== iwad.longDescription) {
                                                iwad.longDescription = longDescription;
                                                if (dev) {
                                                    console.log(
                                                        'buildIwad:: adding ' + longDescription + ' to ' + fullPath
                                                    );
                                                    console.log('reloadFiles: ' + reloadFiles);
                                                }
                                                iwadCollection.update(iwad);
                                                if (reloadFiles) {
                                                    self.loadIwadFiles();
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    },
                    err => {
                        if (err) {
                            throw err;
                        }
                    }
                );
            });
        }
        walk(directoryName);
    };

    self.buildPwadCollection = reloadFiles => {
        let directoryName = self.pwadDirectory;
        function walk(directory) {
            fs.readdir(directory, (e, files) => {
                if (e) {
                    console.log('Error: ', e);
                    return;
                }
                files.forEach(
                    file => {
                        let fullPath = path.join(directory, file);
                        fs.stat(fullPath, (e, f) => {
                            if (e) {
                                console.log('Error: ', e);
                                return;
                            }
                            if (f.isDirectory()) {
                                if (dev) {
                                    console.log('buildPwad:: ' + file + ' and is directory: ' + fullPath);
                                }
                                walk(fullPath);
                            } else {
                                let fileExt = file.substring(file.lastIndexOf('.') + 1);

                                if (pwadTypes.indexOf(fileExt) > -1) {
                                    let pwad = {
                                        filename: file,
                                        filepath: fullPath
                                    };
                                    if (dev) {
                                        console.log('buildPwad:: adding ' + fullPath);
                                        console.log('reloadFiles: ' + reloadFiles);
                                    }
                                    upsert(pwadCollection, 'filename', pwad);
                                    if (reloadFiles) {
                                        self.loadPwadFiles();
                                    }
                                } else if (fileExt === 'json') {
                                    fs.readFile(fullPath, 'utf8', (err, data) => {
                                        if (err) {
                                            console.log('file read error!' + err);
                                        } else {
                                            let pwad = JSON.parse(data);
                                            pwad.filepath = fullPath;
                                            if (dev) {
                                                console.log('buildPwad:: adding ' + fullPath);
                                                console.log('reloadFiles: ' + reloadFiles);
                                            }
                                            upsert(pwadCollection, 'filename', pwad);
                                            if (reloadFiles) {
                                                self.loadPwadFiles();
                                            }
                                        }
                                    });
                                } else if (fileExt === 'txt') {
                                    let pwad = pwadCollection.find({ filename: f })[0];
                                    fs.readFile(fullPath, 'utf8', (err, data) => {
                                        if (err) {
                                            console.log('file read error!' + err);
                                        } else {
                                            let longDescription = data;
                                            if (pwad && longDescription !== pwad.longDescription) {
                                                pwad.longDescription = longDescription;
                                                if (dev) {
                                                    console.log(
                                                        'buildPwad:: adding ' + longDescription + ' to ' + fullPath
                                                    );
                                                    console.log('reloadFiles: ' + reloadFiles);
                                                }
                                                pwadCollection.update(pwad);
                                                if (reloadFiles) {
                                                    self.loadPwadFiles();
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    },
                    err => {
                        if (err) {
                            throw err;
                        }
                    }
                );
            });
        }
        walk(directoryName);
    };

    self.buildSourceportCollection = reloadFiles => {
        let directoryName = self.sourceportDirectory;
        function walk(directory) {
            fs.readdir(directory, (e, files) => {
                if (e) {
                    console.log('Error: ', e);
                    return;
                }
                files.forEach(
                    file => {
                        let fullPath = path.join(directory, file);
                        fs.stat(fullPath, (e, f) => {
                            if (e) {
                                console.log('Error: ', e);
                                return;
                            }
                            if (f.isDirectory()) {
                                if (dev) {
                                    console.log('buildSourceport:: ' + file + ' and is directory: ' + fullPath);
                                }
                                walk(fullPath);
                            } else {
                                let fileExt = file.substring(file.lastIndexOf('.') + 1);

                                if (fileExt === 'exe') {
                                    let sourceport = {
                                        filename: file,
                                        filepath: fullPath
                                    };
                                    if (dev) {
                                        console.log('buildSourceport:: adding ' + fullPath);
                                        console.log('reloadFiles: ' + reloadFiles);
                                    }
                                    upsert(sourceportCollection, 'filename', sourceport);
                                    if (reloadFiles) {
                                        self.loadSourceportFiles();
                                    }
                                } else if (fileExt === 'json') {
                                    fs.readFile(fullPath, 'utf8', (err, data) => {
                                        if (err) {
                                            console.log('file read error!' + err);
                                        } else {
                                            let sourceport = JSON.parse(data);
                                            sourceport.filepath = fullPath;
                                            if (dev) {
                                                console.log('buildSourceport:: adding ' + fullPath);
                                                console.log('reloadFiles: ' + reloadFiles);
                                            }
                                            upsert(sourceportCollection, 'filename', sourceport);
                                            if (reloadFiles) {
                                                self.loadSourceportFiles();
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    },
                    err => {
                        if (err) {
                            throw err;
                        }
                    }
                );
            });
        }
        walk(directoryName);
    };

    self.iwadSearch = ko.observable();
    self.pwadSearch = ko.observable();
    self.sourceportSearch = ko.observable();

    self.findIwad = () => {
        let result = [];
        if (self.iwadSearch() && self.iwadSearch().trim() != '') {
            let text = self.iwadSearch().toUpperCase();
            result = iwadCollection.where(obj => {
                let containsName = obj.name && obj.name.toUpperCase().indexOf(text) > -1;
                let containsFilename = obj.filename && obj.filename.toUpperCase().indexOf(text) > -1;
                let containsMetaTag = () => {
                    let doesContain = false;
                    if (obj.metaTags) {
                        _.forEach(obj.metaTags, tag => {
                            if (!doesContain) {
                                doesContain = tag.toUpperCase().indexOf(text) > -1;
                            }
                        });
                    }
                    return doesContain;
                };
                let containsAuthor = () => {
                    let doesContain = false;
                    if (obj.authors) {
                        _.forEach(obj.authors, author => {
                            if (!doesContain) {
                                doesContain = author.toUpperCase().indexOf(text) > -1;
                            }
                        });
                    }
                    return doesContain;
                };
                let containsSource = obj.source && obj.source.toUpperCase().indexOf(text) > -1;
                let containsQuickDescription =
                    obj.quickDescription && obj.quickDescription.toUpperCase().indexOf(text) > -1;
                let containsLongDescription =
                    obj.longDescription && obj.longDescription.toUpperCase().indexOf(text) > -1;
                return (
                    containsName ||
                    containsFilename ||
                    containsMetaTag() ||
                    containsAuthor() ||
                    containsSource ||
                    containsQuickDescription ||
                    containsLongDescription
                );
            });
        } else {
            result = iwadCollection.find();
        }
        let newIwads = [];
        if (result && result.length > 0) {
            _.forEach(result, iwad => {
                let newIwad = new File(
                    iwad.filename,
                    iwad.authors,
                    iwad.metaTags,
                    iwad.source,
                    iwad.name,
                    iwad.quickDescription,
                    iwad.longDescription,
                    'iwad',
                    iwad.hidden,
                    iwad.subtype
                );
                newIwads.push(newIwad);
            });
        }
        self.files.iwads.removeAll();
        if (newIwads.length > 0) {
            self.files.iwads.push.apply(self.files.iwads, newIwads);
        }
    };
    self.findPwad = () => {
        let result = [];
        if (self.pwadSearch() && self.pwadSearch().trim() != '') {
            let text = self.pwadSearch().toUpperCase();
            result = pwadCollection.where(obj => {
                let containsName = obj.name && obj.name.toUpperCase().indexOf(text) > -1;
                let containsFilename = obj.filename && obj.filename.toUpperCase().indexOf(text) > -1;
                let containsMetaTag = () => {
                    let doesContain = false;
                    if (obj.metaTags) {
                        _.forEach(obj.metaTags, tag => {
                            if (!doesContain) {
                                doesContain = tag.toUpperCase().indexOf(text) > -1;
                            }
                        });
                    }
                    return doesContain;
                };
                let containsAuthor = () => {
                    let doesContain = false;
                    if (obj.authors) {
                        _.forEach(obj.authors, author => {
                            if (!doesContain) {
                                doesContain = author.toUpperCase().indexOf(text) > -1;
                            }
                        });
                    }
                    return doesContain;
                };
                let containsSource = obj.source && obj.source.toUpperCase().indexOf(text) > -1;
                let containsQuickDescription =
                    obj.quickDescription && obj.quickDescription.toUpperCase().indexOf(text) > -1;
                let containsLongDescription =
                    obj.longDescription && obj.longDescription.toUpperCase().indexOf(text) > -1;
                return (
                    containsName ||
                    containsFilename ||
                    containsMetaTag() ||
                    containsAuthor() ||
                    containsSource ||
                    containsQuickDescription ||
                    containsLongDescription
                );
            });
        } else {
            result = pwadCollection.find();
        }
        let newPwads = [];
        if (result && result.length > 0) {
            _.forEach(result, pwad => {
                let newPwad = new File(
                    pwad.filename,
                    pwad.authors,
                    pwad.metaTags,
                    pwad.source,
                    pwad.name,
                    pwad.quickDescription,
                    pwad.longDescription,
                    'pwad',
                    pwad.hidden
                );
                newPwads.push(newPwad);
            });
        }
        self.files.pwads.removeAll();
        if (newPwads.length > 0) {
            self.files.pwads.push.apply(self.files.pwads, newPwads);
        }
    };
    self.findSourceport = () => {
        let result = [];
        if (self.sourceportSearch() && self.sourceportSearch().trim() != '') {
            let text = self.sourceportSearch().toUpperCase();
            result = sourceportCollection.where(obj => {
                let containsName = obj.name && obj.name.toUpperCase().indexOf(text) > -1;
                let containsFilename = obj.filename && obj.filename.toUpperCase().indexOf(text) > -1;
                let containsMetaTag = () => {
                    let doesContain = false;
                    if (obj.metaTags) {
                        _.forEach(obj.metaTags, tag => {
                            if (!doesContain) {
                                doesContain = tag.toUpperCase().indexOf(text) > -1;
                            }
                        });
                    }
                    return doesContain;
                };
                let containsAuthor = () => {
                    let doesContain = false;
                    if (obj.authors) {
                        _.forEach(obj.authors, author => {
                            if (!doesContain) {
                                doesContain = author.toUpperCase().indexOf(text) > -1;
                            }
                        });
                    }
                    return doesContain;
                };
                let containsSource = obj.source && obj.source.toUpperCase().indexOf(text) > -1;
                let containsQuickDescription =
                    obj.quickDescription && obj.quickDescription.toUpperCase().indexOf(text) > -1;
                let containsLongDescription =
                    obj.longDescription && obj.longDescription.toUpperCase().indexOf(text) > -1;
                return (
                    containsName ||
                    containsFilename ||
                    containsMetaTag() ||
                    containsAuthor() ||
                    containsSource ||
                    containsQuickDescription ||
                    containsLongDescription
                );
            });
        } else {
            result = sourceportCollection.find();
        }
        let newSourceports = [];
        if (result && result.length > 0) {
            _.forEach(result, sourceport => {
                let newSourceport = new File(
                    sourceport.filename,
                    sourceport.authors,
                    sourceport.metaTags,
                    sourceport.source,
                    sourceport.name,
                    sourceport.quickDescription,
                    sourceport.longDescription,
                    'sourceport',
                    sourceport.hidden,
                    sourceport.subtype
                );
                newSourceports.push(newSourceport);
            });
        }
        self.files.sourceports.removeAll();
        if (newSourceports.length > 0) {
            self.files.sourceports.push.apply(self.files.sourceports, newSourceports);
        }
    };

    self.walk = directoryName => {
        fs.readdir(directoryName, (e, files) => {
            if (e) {
                console.log('Error: ', e);
                return;
            }
            files.forEach(file => {
                let fullPath = path.join(directoryName, file);
                fs.stat(fullPath, (e, f) => {
                    if (e) {
                        console.log('Error: ', e);
                        return;
                    }
                    if (f.isDirectory()) {
                        console.log(fullPath);
                        self.walk(fullPath);
                    } else {
                        self.Allfiles.push(fullPath);
                        self.Allfiles.sort();
                        console.log(fullPath);
                    }
                });
            });
        });
    };

    self.currentConfig = {};

    self.loadDefaultConfig = () => {
        self.currentConfig = new ConfigChain(
            'Default',
            'This is the Default Configuration',
            null,
            null,
            null,
            'solo',
            null,
            null,
            null,
            null,
            null
        );
    };

    self.configSearch = ko.observable('');

    self.runCurrentConfig = () => {};

    self.exportCurrentConfig = () => {};

    self.saveCurrentConfig = () => {};

    self.findConfig = () => {};

    self.clearCurrentConfig = () => {};

    self.init = () => {
        //self.goToView(self.views[0]);
        console.log('loading files');
        self.loadCollections(true);

        //TODO: remove this when you can start loading configs from files.
        self.loadDefaultConfig();
    };
    self.init();
}

function ready(fn) {
    if (document.attachEvent ? document.readyState === 'complete' : document.readyState !== 'loading') {
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}
ready(() => {
    /* this was fun, but seriously, no
    document.querySelectorAll('body')[0].addEventListener('click', function () {
        document.bgColor = 'red';
    });
    */
    /**
     * let's activate the titlebar so we can close this bad boy
     */
    /* eslint-disable no-new */
    let titleOptions = {
        backgroundColor: titlebar.Color.fromHex('#000'),
        icon: 'ego.ico'
    };
    if (!dev) {
        titleOptions.menu = null;
    }
    new titlebar.Titlebar(titleOptions);
    /* eslint-enable no-new */
    $('[data-toggle="tooltip"]').tooltip();
    // Activates knockout.js
    ko.bindingHandlers.uniqueId = {
        init: (element, valueAccessor) => {
            let value = valueAccessor();
            value.id = value.id || ko.bindingHandlers.uniqueId.prefix + ++ko.bindingHandlers.uniqueId.counter;

            element.id = value.id;
        },
        counter: 0,
        prefix: 'unique'
    };

    ko.bindingHandlers.uniqueFor = {
        init: (element, valueAccessor) => {
            let value = valueAccessor();
            value.id = value.id || ko.bindingHandlers.uniqueId.prefix + ++ko.bindingHandlers.uniqueId.counter;

            element.setAttribute('for', value.id);
        }
    };
    ko.bindingHandlers.tooltip = {
        init: (element, valueAccessor) => {
            let value = valueAccessor();
            $(element).attr('title', value);
            $(element).tooltip();
        },
        update: (element, valueAccessor) => {
            let value = valueAccessor();
            $(element).attr('data-original-title', value);
            $(element).tooltip();
        }
    };
    var viewModel = new AppViewModel();
    viewModel.currentConfig.sourceport.subscribe(data => {
        viewModel.chooseSourceport(data);
    });
    ko.applyBindings(viewModel);
});
// This is a simple *viewmodel* - JavaScript that defines the data and behavior of your UI
