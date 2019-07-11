'use strict';
const ko = require('knockout');
const path = require('path');
const fs = require('fs');
const titlebar = require('custom-electron-titlebar');
const Loki = require('lokijs');
const _ = require('lodash');
const pwadTypes = ['wad', 'pk3', 'deh', 'bex'];
const iwadFileTypes = ['wad', 'pk3'];
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
let previousConfigCollection = getCollection('previousConfigs');
let commandLineCollection = getCollection('commands');
let DMFlagsCollection = getCollection('DMFlags');
let levelsCollection = getCollection('levels');
let skillLevelsCollection = getCollection('skillLevels');

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
            upsert(commandLineCollection, 'uniqueCommandId', command);
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
fs.readFile(path.resolve(__dirname, '../../SkillLevels.json'), 'utf8', (err, data) => {
    if (err) {
        console.log('file read error!' + err);
    } else {
        let skillLevels = JSON.parse(data);
        /*
        if (dev) {
            console.log('buildIwad:: adding ' + fullPath);
            console.log('reloadFiles: ' + reloadFiles);
        }*/
        _.forEach(skillLevels, skillLevel => {
            upsert(skillLevelsCollection, 'iwad', skillLevel);
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
        if (record.$loki){
            delete record.$loki;
        }
        // The record exists. Do an update.
        let updatedRecord = existingRecord;
        // Only update the fields contained in `record`. All fields not contained
        // in `record` remain unchanged.
        _.forEach(record, (value, key) => {
            updatedRecord[key] = value;
        });
        collection.update(updatedRecord);
    } else {
        if (record.$loki){
            delete record.$loki;
        }
        // The record doesn't exist. Do an insert.
        collection.insert(record);
    }
}

function ConfigChain(
    id,
    configName,
    configDescription,
    sourceport,
    iniFile,
    iwad,
    gamemode,
    level,
    skill,
    pwads,
    dmFlags,
    sourceportConfigs
) {
    let self = this;
    self.id = ko.observable(id);
    self.configName = ko.observable(configName);
    self.configDescription = ko.observable(configDescription);
    self.sourceport = ko.observable(sourceport);
    self.chosenIniFile = ko.observable(iniFile);

    self.iwad = ko.observable(iwad);

    self.gamemode = ko.observable(gamemode);
    self.level = ko.observable(level);
    self.skill = ko.observable(skill);
    self.dmFlags = ko.observableArray();
    self.setDMFlags = dmFlags => {
        if (dmFlags) {
            self.dmFlags.removeAll();
            _.forEach(dmFlags, dmflag => {
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
    };
    self.setDMFlags(dmFlags);

    self.pwads = ko.observableArray();
    self.setPwads = pwads => {
        if (pwads) {
            self.pwads.removeAll();
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
                    pwad.filetype,
                    pwad.hidden,
                    pwad.basetype
                );
                self.pwads.push(newPWad);
            });
        }
    };
    self.setPwads(pwads);

    self.setSourceportConfigs = sourceportConfigs => {
        if (sourceportConfigs) {
            _.forEach(Object.keys(sourceportConfigs), category => {
                self.sourceportConfigs[category].removeAll();
                _.forEach(sourceportConfigs[category], command => {
                    let newCommand = new CommandLineOption(
                        command.enabled,
                        command.name,
                        command.inputType,
                        command.description,
                        command.command,
                        command.value,
                        command.sourceports,
                        command.category,
                        command.valueRange,
                        command.valueset,
                        command.uniqueCommandId
                    );
                    self.sourceportConfigs[category].push(newCommand);
                });
            });
        }
    };

    self.sourceportConfigs = {
        config: ko.observableArray(),
        multiplayer: ko.observableArray(),
        networking: ko.observableArray(),
        debug: ko.observableArray(),
        display: ko.observableArray(),
        gameplay: ko.observableArray(),
        recording: ko.observableArray(),
        advanced: ko.observableArray()
    };
    self.setSourceportConfigs(sourceportConfigs);

    self.displayName = ko.computed(() => {
        let sourceportName = '';
        let iwadName = '';
        if (self.sourceport()) {
            sourceportName = path.basename(self.sourceport());
        }
        if (self.iwad()) {
            iwadName = path.basename(self.iwad());
        }
        return self.configName() + ' - ' + iwadName + ' - ' + sourceportName;
    });

    //this will be generated from the current config chain
    self.generatedCommand = ko.computed(() => {
        let command = '';
        if (self.sourceport()) {
            command += self.sourceport() + ' ';
        }
        if (self.iwad()) {
            command += '-iwad ' + self.iwad() + ' ';
        }
        if (self.chosenIniFile()) {
            command += '-config ' + self.chosenIniFile() + ' ';
        }
        if (self.level()) {
            command += '-warp ' + self.level() + ' ';
        }
        if (self.skill()) {
            command += '-skill ' + self.skill() + ' ';
        }
        if (self.pwads() && self.pwads().length > 0) {
            command += '-file ';
            _.forEach(self.pwads(), pwad => {
                command += '"' + pwad.filepath + '" ';
            });
        }
        if (self.dmFlags()) {
            let dmFlags = [];
            let dmFlags2 = [];
            let zadmflags = [];
            let compatflags = [];
            let zacompatflags = [];
            _.forEach(self.dmFlags(), dmFlag => {
                if (dmFlag.enabled()) {
                    switch (dmFlag.command) {
                        case 'dmflags':
                            dmFlags.push(dmFlag);
                            break;
                        case 'dmflags2':
                            dmFlags2.push(dmFlag);
                            break;
                        case 'zadmflags':
                            zadmflags.push(dmFlag);
                            break;
                        case 'compatflags':
                            compatflags.push(dmFlag);
                            break;
                        case 'zacompatflags':
                            zacompatflags.push(dmFlag);
                            break;
                    }
                }
            });
            if (dmFlags.length > 0) {
                let flagValue = 0;
                _.forEach(dmFlags, flag => {
                    flagValue += flag.value;
                });
                command += '+dmflags ' + flagValue + ' ';
            }
            if (dmFlags2.length > 0) {
                let flagValue = 0;
                _.forEach(dmFlags2, flag => {
                    flagValue += flag.value;
                });
                command += '+dmflags2 ' + flagValue + ' ';
            }
            if (zadmflags.length > 0) {
                let flagValue = 0;
                _.forEach(zadmflags, flag => {
                    flagValue += flag.value;
                });
                command += '+zadmflags ' + flagValue + ' ';
            }
            if (compatflags.length > 0) {
                let flagValue = 0;
                _.forEach(compatflags, flag => {
                    flagValue += flag.value;
                });
                command += '+compatflags ' + flagValue + ' ';
            }
            if (zacompatflags.length > 0) {
                let flagValue = 0;
                _.forEach(zacompatflags, flag => {
                    flagValue += flag.value;
                });
                command += '+zacompatflags ' + flagValue + ' ';
            }
        }
        if (self.sourceportConfigs) {
            if (self.sourceportConfigs.config()) {
                _.forEach(self.sourceportConfigs.config(), config => {
                    if (config.enabled()) {
                        let value = '';
                        if (config.inputType === 'files' || config.inputType === 'directory') {
                            if (config.value()) {
                                _.forEach(config.value().split(';'), file => {
                                    value += '"' + file + '" ';
                                });
                                value = value.substring(0, value.length - 1);
                            }
                        } else {
                            value = config.value();
                        }
                        command += config.command + ' ' + (value ? value : '') + ' ';
                    }
                });
            }
            if (self.sourceportConfigs.multiplayer()) {
                _.forEach(self.sourceportConfigs.multiplayer(), config => {
                    if (config.enabled()) {
                        let value = '';
                        if (config.inputType === 'files' || config.inputType === 'directory') {
                            if (config.value()) {
                                _.forEach(config.value().split(';'), file => {
                                    value += '"' + file + '" ';
                                });
                                value = value.substring(0, value.length - 1);
                            }
                        } else {
                            value = config.value();
                        }
                        command += config.command + ' ' + (value ? value : '') + ' ';
                    }
                });
            }
            if (self.sourceportConfigs.networking()) {
                _.forEach(self.sourceportConfigs.networking(), config => {
                    if (config.enabled()) {
                        let value = '';
                        if (config.inputType === 'files' || config.inputType === 'directory') {
                            if (config.value()) {
                                _.forEach(config.value().split(';'), file => {
                                    value += '"' + file + '" ';
                                });
                                value = value.substring(0, value.length - 1);
                            }
                        } else {
                            value = config.value();
                        }
                        command += config.command + ' ' + (value ? value : '') + ' ';
                    }
                });
            }
            if (self.sourceportConfigs.debug()) {
                _.forEach(self.sourceportConfigs.debug(), config => {
                    if (config.enabled()) {
                        let value = '';
                        if (config.inputType === 'files' || config.inputType === 'directory') {
                            if (config.value()) {
                                _.forEach(config.value().split(';'), file => {
                                    value += '"' + file + '" ';
                                });
                                value = value.substring(0, value.length - 1);
                            }
                        } else {
                            value = config.value();
                        }
                        command += config.command + ' ' + (value ? value : '') + ' ';
                    }
                });
            }
            if (self.sourceportConfigs.display()) {
                _.forEach(self.sourceportConfigs.display(), config => {
                    if (config.enabled()) {
                        let value = '';
                        if (config.inputType === 'files' || config.inputType === 'directory') {
                            if (config.value()) {
                                _.forEach(config.value().split(';'), file => {
                                    value += '"' + file + '" ';
                                });
                                value = value.substring(0, value.length - 1);
                            }
                        } else {
                            value = config.value();
                        }
                        command += config.command + ' ' + (value ? value : '') + ' ';
                    }
                });
            }
            if (self.sourceportConfigs.recording()) {
                _.forEach(self.sourceportConfigs.recording(), config => {
                    if (config.enabled()) {
                        let value = '';
                        if (config.inputType === 'files' || config.inputType === 'directory') {
                            if (config.value()) {
                                _.forEach(config.value().split(';'), file => {
                                    value += '"' + file + '" ';
                                });
                                value = value.substring(0, value.length - 1);
                            }
                        } else {
                            value = config.value();
                        }
                        command += config.command + ' ' + (value ? value : '') + ' ';
                    }
                });
            }
            if (self.sourceportConfigs.advanced()) {
                _.forEach(self.sourceportConfigs.advanced(), config => {
                    if (config.enabled()) {
                        let value = '';
                        if (config.inputType === 'files' || config.inputType === 'directory') {
                            if (config.value()) {
                                _.forEach(config.value().split(';'), file => {
                                    value += '"' + file + '" ';
                                });
                                value = value.substring(0, value.length - 1);
                            }
                        } else {
                            value = config.value();
                        }
                        command += config.command + ' ' + (value ? value : '') + ' ';
                    }
                });
            }
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

function CommandLineOption(
    enabled,
    name,
    inputType,
    description,
    command,
    value,
    sourceports,
    category,
    valueRange,
    valueset,
    uniqueCommandId
) {
    let self = this;
    self.name = name;
    self.inputType = inputType;
    self.description = description;
    self.command = command;
    self.value = ko.observable(value);
    self.enabled = ko.observable(enabled);
    self.sourceports = sourceports;
    self.category = category;
    self.valueset = valueset;
    self.valueRange = valueRange;
    self.uniqueCommandId = uniqueCommandId;
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
    filetype,
    hidden,
    basetype
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
    self.filetype = ko.observable(filetype);
    self.filetypeValid = ko.computed(() => {
        return (
            self.filetype() &&
            self.filetype().length > 0 &&
            (self.filetype() === 'iwad' || self.filetype() === 'sourceport' || self.filetype() === 'pwad')
        );
    });
    self.hidden = ko.observable(false);
    if (hidden === true) {
        self.hidden(true);
    }
    self.basetype = ko.observable(basetype);
    self.hideFile = () => {
        let isHidden = self.hidden();
        self.hidden(!isHidden);
    };

    self.sourceportBasetype = ko.observable();
    if (filetype === 'sourceport') {
        self.sourceportBasetype(basetype);
    }
    self.iwadBasetype = ko.observable();
    if (filetype === 'iwad') {
        self.iwadBasetype(basetype);
    }

    self.error = ko.computed(() => {
        return !self.authorsValid() || !self.sourceValid() || !self.filetypeValid();
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

function Level(level, chosenIwadType) {
    let self = this;
    if (level) {
        self.warptext = level.warptext;
        self.name = level.name;
        self.doom = level.doom;
        self.heretic = level.heretic;
        self.doom2 = level.doom2;
        self.tnt = level.tnt;
        self.plutonia = level.plutonia;
        self.hexen = level.hexen;
        self.strife = level.strife;
        self.hacx = level.hacx;
        self.nerve = level.nerve;
        self.chex = level.chex;
        self.displayName = ko.computed(() => {
            switch (chosenIwadType) {
                case 'doom':
                    return self.name + ' - ' + self.doom;
                    break;
                case 'heretic':
                    return self.name + ' - ' + self.heretic;
                    break;
                case 'doom2':
                    return self.name + ' - ' + self.doom2;
                    break;
                case 'tnt':
                    return self.name + ' - ' + self.tnt;
                    break;
                case 'plutonia':
                    return self.name + ' - ' + self.plutonia;
                    break;
                case 'hexen':
                    return self.name + ' - ' + self.hexen;
                    break;
                case 'strife':
                    return self.name + ' - ' + self.strife;
                    break;
                case 'hacx':
                    return self.name + ' - ' + self.hacx;
                    break;
                case 'nerve':
                    return self.name + ' - ' + self.nerve;
                    break;
                case 'chex':
                    return self.name + ' - ' + self.chex;
                    break;
                default:
                    return self.name;
            }
        });
    }
}

function SkillLevel(name, level) {
    let self = this;
    self.name = name;
    self.skillLevel = level;
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
    self.skillLevels = ko.observableArray();
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
            description: 'The Plutonia Experiment'
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

    self.levels = ko.observableArray();
    self.Allfiles = ko.observableArray();
    self.files = {
        iwads: ko.observableArray(),
        pwads: ko.observableArray(),
        sourceports: ko.observableArray()
    };
    self.availablePwads = ko.observableArray();
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
    self.loadCollections = reloadFiles => {
        self.buildIwadCollection(reloadFiles);
        self.buildPwadCollection(reloadFiles);
        self.buildSourceportCollection(reloadFiles);
    };
    self.chosenFile = ko.observable();
    self.chosenPreviousConfig = ko.observable();
    self.editFile = (filetype, index) => {
        let file = {};
        switch (filetype()) {
            case 'iwad':
                file = self.files.iwads()[index()];
                break;
            case 'pwad':
                file = self.files.pwads()[index()];
                break;
            case 'sourceport':
                file = self.files.sourceports()[index()];
                break;
        }
        let rawFileProperties = {
            filename: file.filename,
            authors: file.authors(),
            metaTags: file.metaTags(),
            source: file.source(),
            name: file.name(),
            quickDescription: file.quickDescription(),
            longDescription: file.longDescription(),
            hidden: file.hidden(),
            basetype: file.basetype(),
            filepath: file.filepath,
            filetype: file.filetype()
        };
        self.chosenFile(
            new File(
                rawFileProperties.filepath,
                rawFileProperties.filename,
                rawFileProperties.authors,
                rawFileProperties.metaTags,
                rawFileProperties.source,
                rawFileProperties.name,
                rawFileProperties.quickDescription,
                rawFileProperties.longDescription,
                rawFileProperties.filetype,
                rawFileProperties.hidden,
                rawFileProperties.basetype
            )
        );
        if (self.chosenFile().filetype() === 'iwad') {
            self.chosenFile().iwadBasetype = ko.observable(self.chosenFile().basetype());
        } else if (self.chosenFile().filetype() === 'sourceport') {
            self.chosenFile().sourceportBasetype = ko.observable(self.chosenFile().basetype());
        }
    };
    self.clearFileEdit = () => {
        self.chosenFile(null);
    };
    self.updateFile = () => {
        let rawFileProperties = {
            filename: self.chosenFile().filename,
            authors: self.chosenFile().authors(),
            metaTags: self.chosenFile().metaTags(),
            source: self.chosenFile().source(),
            name: self.chosenFile().name(),
            quickDescription: self.chosenFile().quickDescription(),
            longDescription: self.chosenFile().longDescription(),
            hidden: self.chosenFile().hidden()
        };
        if (self.chosenFile().filetype() === 'iwad') {
            rawFileProperties.basetype = self.chosenFile().iwadBasetype();
        } else if (self.chosenFile().filetype() === 'sourceport') {
            rawFileProperties.basetype = self.chosenFile().sourceportBasetype();
        }
        let directory = path.dirname(self.chosenFile().filepath);
        let RealFilename = self.chosenFile().filepath.substring(0, self.chosenFile().filepath.lastIndexOf('.'));
        fs.writeFile(path.resolve(directory, RealFilename + '.json'), JSON.stringify(rawFileProperties), err => {
            if (err) {
                return console.log(err);
            }
            switch (self.chosenFile().filetype()) {
                case 'iwad':
                    self.buildIwadCollection(true);
                    break;
                case 'pwad':
                    self.buildPwadCollection(true);
                    break;
                case 'sourceport':
                    self.buildSourceportCollection(true);
                    break;
            }
        });
        self.loadLevels();
        self.loadSkillLevels();
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
                iwad.basetype
            );
            newIwads.push(newIwad);
        });
        self.files.iwads.removeAll();
        self.files.iwads.push.apply(self.files.iwads, newIwads);
        self.loadLevels();
        self.loadSkillLevels();
    };

    self.loadPwadFiles = () => {
        let allPwads = pwadCollection.find();
        let newPwads = [];
        let newAvailablePwads = [];
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
            let inchosen = false;
            _.forEach(self.currentConfig().pwads(), pwad => {
                if (newPwad.filepath === pwad.filepath) {
                    inchosen = true;
                }
            });
            if (!inchosen) {
                newAvailablePwads.push(newPwad);
            }
        });
        self.files.pwads.removeAll();
        self.availablePwads.removeAll();
        self.files.pwads.push.apply(self.files.pwads, newPwads);
        self.availablePwads.push.apply(self.availablePwads, newAvailablePwads);
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
                sourceport.basetype
            );
            newSourceports.push(newSourceport);
        });
        self.files.sourceports.removeAll();
        self.files.sourceports.push.apply(self.files.sourceports, newSourceports);
    };
    self.previousConfigChains = ko.observableArray();
    self.configChains = ko.observableArray();
    self.loadConfigChains = () => {
        let allConfigChains = configCollection.find();
        if (allConfigChains.length<1){
            self.currentConfig().id(1);
            self.saveCurrentConfig();
            allConfigChains = configCollection.find();
        }
        let newConfigChains = [];
        _.forEach(allConfigChains, configChain => {
            let newConfigChain = new ConfigChain(
                configChain.$loki,
                configChain.configName,
                configChain.configDescription,
                configChain.sourceport,
                configChain.iniFile,
                configChain.iwad,
                configChain.gamemode,
                configChain.level,
                configChain.skill,
                configChain.pwads,
                configChain.dmFlags,
                configChain.sourceportConfigs
            );
            newConfigChains.push(newConfigChain);
        });
        self.configChains.removeAll();
        self.configChains.push.apply(self.configChains, newConfigChains);
    };

    self.loadPreviousConfigChains = () => {
        let allConfigChains = previousConfigCollection.find();
        let newConfigChains = [];
        _.forEach(allConfigChains, configChain => {
            let newConfigChain = new ConfigChain(
                configChain.$loki,
                configChain.configName,
                configChain.configDescription,
                configChain.sourceport,
                configChain.iniFile,
                configChain.iwad,
                configChain.gamemode,
                configChain.level,
                configChain.skill,
                configChain.pwads,
                configChain.dmFlags,
                configChain.sourceportConfigs
            );
            newConfigChains.push(newConfigChain);
        });
        self.previousConfigChains.removeAll();
        newConfigChains.reverse();
        self.previousConfigChains.push.apply(self.previousConfigChains, newConfigChains);
    };

    self.iniFiles = ko.observableArray();

    self.chooseSourceport = sourceport => {
        if (sourceport) {
            self.getIniFilesForGivenSourceport(sourceport);
        } else {
            self.iniFiles.removeAll();
        }
    };
    self.getIwad = filepath => {
        let iwad = {};
        for (let i = 0; i < self.files.iwads().length; ++i) {
            if (self.files.iwads()[i].filepath === filepath) {
                iwad = self.files.iwads()[i];
                break;
            }
        }
        return iwad;
    };
    self.loadLevels = () => {
        self.levels.removeAll();
        let query = null;
        let basetype = null;
        if (self.currentConfig().iwad() != null) {
            let iwad = self.getIwad(self.currentConfig().iwad());
            basetype = iwad.iwadBasetype();
            query = { [basetype]: { $exists: true, $ne: null } };
        }
        let allLevels = levelsCollection.find(query);
        let newLevels = [];
        _.forEach(allLevels, level => {
            let newLevel = new Level(level, basetype);
            newLevels.push(newLevel);
        });
        if (newLevels.length > 0) {
            self.levels.push.apply(self.levels, newLevels);
        }
    };
    self.loadSkillLevels = () => {
        self.skillLevels.removeAll();
        let query = null;
        let iwadType = null;
        if (self.currentConfig().iwad() != null) {
            let iwad = self.getIwad(self.currentConfig().iwad());
            iwadType = iwad.iwadBasetype();
        } else {
            iwadType = 'doom';
        }
        query = { iwad: iwadType };
        let skillLevelSets = skillLevelsCollection.find(query);
        let newSkillLevels = [];
        _.forEach(skillLevelSets, skillLevelSet => {
            _.forEach(skillLevelSet.skillLevels, skillLevel => {
                let newSkillLevel = new SkillLevel(skillLevel.name, skillLevel.skillLevel);
                newSkillLevels.push(newSkillLevel);
            });
        });
        if (newSkillLevels.length > 0) {
            self.skillLevels.push.apply(self.skillLevels, newSkillLevels);
        }
    };
    self.loadAllCommandLineOptions = () => {
        self.loadCommandLineOptions('config');
        self.loadCommandLineOptions('multiplayer');
        self.loadCommandLineOptions('networking');
        self.loadCommandLineOptions('debug');
        self.loadCommandLineOptions('display');
        self.loadCommandLineOptions('gameplay');
        self.loadCommandLineOptions('recording');
        self.loadCommandLineOptions('advanced');
    };

    self.getSourceport = filepath => {
        let sourceport = {};
        for (let i = 0; i < self.files.sourceports().length; ++i) {
            if (self.files.sourceports()[i].filepath === filepath) {
                sourceport = self.files.sourceports()[i];
                break;
            }
        }
        return sourceport;
    };

    self.loadDMFlags = () => {
        self.currentConfig().dmFlags.removeAll();
        let sourceportType = null;
        if (self.currentConfig().sourceport() != null) {
            let sourceport = self.getSourceport(self.currentConfig().sourceport());
            sourceportType = sourceport.sourceportBasetype();
            if (sourceportType) {
                sourceportType = sourceportType.toLowerCase();
            }
        }
        if (sourceportType != null) {
            let newDMFlags = [];
            let dmFlags = DMFlagsCollection.find({ sourceport: sourceportType });
            _.forEach(dmFlags, dmFlag => {
                let newFlag = new DMFlag(
                    false,
                    dmFlag.name,
                    dmFlag.value,
                    dmFlag.description,
                    dmFlag.command,
                    dmFlag.sourceport
                );
                newDMFlags.push(newFlag);
            });
            if (newDMFlags.length > 0) {
                self.currentConfig().dmFlags.push.apply(self.currentConfig().dmFlags, newDMFlags);
            }
        }
    };

    self.loadCommandLineOptions = category => {
        self.currentConfig().sourceportConfigs[category].removeAll();
        let query = null;
        let sourceportType = null;
        if (self.currentConfig().sourceport() != null) {
            let sourceport = self.getSourceport(self.currentConfig().sourceport());
            sourceportType = sourceport.sourceportBasetype();
            if (sourceportType) {
                sourceportType = sourceportType.toLowerCase();
            }
        }
        if (sourceportType != null) {
            query = { category: category, sourceports: { $contains: sourceportType } };
            let commandLineOptions = commandLineCollection.find(query);
            let newOptions = [];
            _.forEach(commandLineOptions, option => {
                let newOption = new CommandLineOption(
                    false,
                    option.name,
                    option.inputType,
                    option.description,
                    option.command,
                    option.value,
                    option.sourceports,
                    option.category,
                    option.valueRange,
                    option.valueset,
                    option.uniqueCommandId
                );
                newOptions.push(newOption);
            });
            if (newOptions.length > 0) {
                self.currentConfig().sourceportConfigs[category].push.apply(
                    self.currentConfig().sourceportConfigs[category],
                    newOptions
                );
            }
        }
    };

    self.getIniFilesForGivenSourceport = sourceport => {
        let directory = path.dirname(sourceport);
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

                                if (iwadFileTypes.indexOf(fileExt) > -1) {
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
                    iwad.basetype
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
                    sourceport.basetype
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

    self.currentConfig = ko.observable();

    self.loadDefaultConfig = () => {
        self.currentConfig(
            new ConfigChain(
                null,
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
            )
        );
    };

    self.configSearch = ko.observable('');

    self.findConfig = () => {
        let result = [];
        if (self.configSearch() && self.configSearch().trim() != '') {
            let text = self.configSearch().toUpperCase();
            result = configCollection.where(obj => {
                let containsName = obj.configName && obj.configName.toUpperCase().indexOf(text) > -1;
                let containsDescription =
                    obj.configDescription && obj.configDescription.toUpperCase().indexOf(text) > -1;
                let containsIniFile = obj.iniFile && obj.iniFile.toUpperCase().indexOf(text) > -1;
                let containsIwad = obj.iwad && obj.iwad.toUpperCase().indexOf(text) > -1;
                let containsGamemode = obj.gamemode && obj.gamemode.toUpperCase().indexOf(text) > -1;
                let containsSkill =
                    obj.skill &&
                    obj.skill
                        .toString()
                        .toUpperCase()
                        .indexOf(text) > -1;
                let containsLevel = obj.level && obj.level.toUpperCase().indexOf(text) > -1;
                let containsPwad = () => {
                    let doesContain = false;
                    if (obj.pwads) {
                        _.forEach(obj.pwads, pwad => {
                            if (!doesContain && pwad.filepath) {
                                doesContain = pwad.filepath.toUpperCase().indexOf(text) > -1;
                            }
                        });
                    }
                    return doesContain;
                };

                return (
                    containsName ||
                    containsDescription ||
                    containsPwad() ||
                    containsIwad ||
                    containsIniFile ||
                    containsGamemode ||
                    containsSkill ||
                    containsLevel
                );
            });
        } else {
            result = configCollection.find();
        }
        let newConfigChains = [];
        if (result && result.length > 0) {
            _.forEach(result, configChain => {
                let newConfigChain = new ConfigChain(
                    configChain.$loki,
                    configChain.configName,
                    configChain.configDescription,
                    configChain.sourceport,
                    configChain.iniFile,
                    configChain.iwad,
                    configChain.gamemode,
                    configChain.level,
                    configChain.skill,
                    configChain.pwads,
                    configChain.dmFlags,
                    configChain.sourceportConfigs
                );
                newConfigChains.push(newConfigChain);
            });
        }
        self.configChains.removeAll();
        if (newConfigChains.length > 0) {
            self.configChains.push.apply(self.configChains, newConfigChains);
        }
    };

    self.runCurrentConfig = () => {
        let config = ko.mapping.toJS(self.currentConfig);
        let configs = previousConfigCollection.find();
        if (configs.length === 50) {
            previousConfigCollection.remove({ $loki: configs[0].$loki });
        }
        previousConfigCollection.insert(config);
        self.loadPreviousConfigChains();
    };

    self.exportCurrentConfig = () => {};

    self.saveCurrentConfig = () => {
        let config = ko.mapping.toJS(self.currentConfig);
        config.$loki = config.id;
        upsert(configCollection, '$loki', config);
        self.loadConfigChains();
    };

    self.deleteConfig = config => {
        if (config) {
            let toJS = ko.mapping.toJS(config);
            configCollection.remove({ $loki: toJS.id });
            self.loadConfigChains();
        }
    };

    self.cloneConfig = config => {
        if (config) {
            let newConfig = ko.mapping.toJS(config);
            newConfig.configName = newConfig.configName + ' - copy';
            configCollection.insert(newConfig);
            let someNewConfigs = configCollection.find();
            let someNewConfig = someNewConfigs[someNewConfigs.length-1];
            someNewConfig.id = someNewConfig.$loki;
            configCollection.update(someNewConfig);
            self.loadConfigChains();
            let newObservableConfig = new ConfigChain(
                someNewConfig.id,
                someNewConfig.configName,
                someNewConfig.configDescription,
                someNewConfig.sourceport,
                someNewConfig.iniFile,
                someNewConfig.iwad,
                someNewConfig.gamemode,
                someNewConfig.level,
                someNewConfig.skill,
                someNewConfig.pwads,
                someNewConfig.dmFlags,
                someNewConfig.sourceportConfigs
            );
            self.loadConfig(newObservableConfig);
        }
    };

    self.loadConfig = config => {
        if (config) {
            let query = {};
            query = { $loki: config.id() };
            let newConfigs = configCollection.find(query);
            let newConfig = newConfigs[0];
            self.currentConfig().configName(newConfig.configName);
            self.currentConfig().configDescription(newConfig.configDescription);
            self.currentConfig().sourceport(newConfig.sourceport);
            self.currentConfig().iwad(newConfig.iwad);
            self.currentConfig().gamemode(newConfig.gamemode);
            self.currentConfig().level(newConfig.level);
            self.currentConfig().skill(newConfig.skill);
            self.currentConfig().setPwads(newConfig.pwads);
            self.currentConfig().setDMFlags(newConfig.dmFlags);
            self.currentConfig().setSourceportConfigs(newConfig.sourceportConfigs);
            self.currentConfig().id(newConfig.id);
            window.setTimeout(() => {
                self.currentConfig().chosenIniFile(newConfig.chosenIniFile);
            }, 100);
            self.loadPwadFiles();
        }
    };

    self.loadPreviousConfig = () => {
        if (self.chosenPreviousConfig()) {
            let newConfig = previousConfigCollection.find({ $loki: self.chosenPreviousConfig() })[0];
            self.currentConfig().configName(newConfig.configName);
            self.currentConfig().configDescription(newConfig.configDescription);
            self.currentConfig().sourceport(newConfig.sourceport);
            self.currentConfig().iwad(newConfig.iwad);
            self.currentConfig().gamemode(newConfig.gamemode);
            self.currentConfig().level(newConfig.level);
            self.currentConfig().skill(newConfig.skill);
            self.currentConfig().setPwads(newConfig.pwads);
            self.currentConfig().setDMFlags(newConfig.dmFlags);
            self.currentConfig().setSourceportConfigs(newConfig.sourceportConfigs);
            window.setTimeout(() => {
                self.currentConfig().chosenIniFile(newConfig.chosenIniFile);
            }, 100);
            self.loadPwadFiles();
        }
    };

    self.init = () => {
        //self.goToView(self.views[0]);
        console.log('loading files');
        self.loadCollections(true);
        self.loadDefaultConfig();
        self.loadPreviousConfigChains();
        self.loadConfigChains();
        //TODO: remove this when you can start loading configs from files.
        
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
function resizeToFitContent(el) {
    // http://stackoverflow.com/a/995374/3297291
    el.style.height = '1px';
    el.style.height = el.scrollHeight + 'px';
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
    ko.bindingHandlers.file = {
        init: (element, valueAccessor) => {
            let value = valueAccessor();
            ko.utils.registerEventHandler(element, 'change', () => {
                if (element.files.length > 0) {
                    let filepath = element.files[0].path;
                    value(filepath);
                }
            });
        }
    };
    ko.bindingHandlers.files = {
        init: (element, valueAccessor) => {
            let value = valueAccessor();
            ko.utils.registerEventHandler(element, 'change', () => {
                let files = element.files;
                if (files.length > 0) {
                    let filepaths = '';
                    _.forEach(files, file => {
                        filepaths += file.path + ';';
                    });
                    filepaths = filepaths.substring(0, filepaths.length - 1);
                    value(filepaths);
                }
            });
        }
    };
    ko.bindingHandlers.directory = {
        init: (element, valueAccessor) => {
            let value = valueAccessor();
            ko.utils.registerEventHandler(element, 'change', () => {
                let files = element.files;
                if (files.length > 0) {
                    let filepaths = '';
                    _.forEach(files, file => {
                        filepaths += file.path + ';';
                    });
                    filepaths = filepaths.substring(0, filepaths.length - 1);
                    value(filepaths);
                }
            });
        }
    };
    ko.bindingHandlers.autoResize = {
        init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
            ko.computed(function() {
                ko.unwrap(valueAccessor());
                resizeToFitContent(element);
            });
        }
    };
    //jqAuto -- main binding (should contain additional options to pass to autocomplete)
    //jqAutoSource -- the array of choices
    //jqAutoValue -- where to write the selected value
    //jqAutoSourceLabel -- the property that should be displayed in the possible choices
    //jqAutoSourceInputValue -- the property that should be displayed in the input box
    //jqAutoSourceValue -- the property to use for the value
    ko.bindingHandlers.jqAuto = {
        init: function(element, valueAccessor, allBindingsAccessor, viewModel) {
            var options = valueAccessor() || {},
                allBindings = allBindingsAccessor(),
                unwrap = ko.utils.unwrapObservable,
                modelValue = allBindings.jqAutoValue,
                source = allBindings.jqAutoSource,
                valueProp = allBindings.jqAutoSourceValue,
                inputValueProp = allBindings.jqAutoSourceInputValue || valueProp,
                labelProp = allBindings.jqAutoSourceLabel || valueProp;

            //function that is shared by both select and change event handlers
            function writeValueToModel(valueToWrite) {
                if (ko.isWriteableObservable(modelValue)) {
                    modelValue(valueToWrite);
                } else {
                    //write to non-observable
                    if (allBindings['_ko_property_writers'] && allBindings['_ko_property_writers']['jqAutoValue'])
                        allBindings['_ko_property_writers']['jqAutoValue'](valueToWrite);
                }
            }

            //on a selection write the proper value to the model
            options.select = function(event, ui) {
                writeValueToModel(ui.item ? ui.item.actualValue : null);
            };

            //on a change, make sure that it is a valid value or clear out the model value
            options.change = function(event, ui) {
                var currentValue = $(element).val();
                var matchingItem = ko.utils.arrayFirst(unwrap(source), function(item) {
                    return unwrap(item[inputValueProp]) === currentValue;
                });

                if (!matchingItem) {
                    writeValueToModel(null);
                }
            };

            //handle the choices being updated in a DO, to decouple value updates from source (options) updates
            var mappedSource = ko.dependentObservable(function() {
                let mapped = ko.utils.arrayMap(unwrap(source), function(item) {
                    var result = {};
                    result.label = labelProp ? unwrap(item[labelProp]) : unwrap(item).toString(); //show in pop-up choices
                    result.value = inputValueProp ? unwrap(item[inputValueProp]) : unwrap(item).toString(); //show in input box
                    result.actualValue = valueProp ? unwrap(item[valueProp]) : item; //store in model
                    return result;
                });
                return mapped;
            });

            //whenever the items that make up the source are updated, make sure that autocomplete knows it
            mappedSource.subscribe(function(newValue) {
                $(element).autocomplete('option', 'source', newValue);
            });

            options.source = mappedSource();

            //initialize autocomplete
            $(element).autocomplete(options);
        },
        update: function(element, valueAccessor, allBindingsAccessor, viewModel) {
            //update value based on a model change
            var allBindings = allBindingsAccessor(),
                unwrap = ko.utils.unwrapObservable,
                modelValue = unwrap(allBindings.jqAutoValue) || '',
                valueProp = allBindings.jqAutoSourceValue,
                inputValueProp = allBindings.jqAutoSourceInputValue || valueProp;

            //if we are writing a different property to the input than we are writing to the model, then locate the object
            if (valueProp && inputValueProp !== valueProp) {
                var source = unwrap(allBindings.jqAutoSource) || [];
                var modelValue =
                    ko.utils.arrayFirst(source, function(item) {
                        return unwrap(item[valueProp]) === modelValue;
                    }) || {}; //probably don't need the || {}, but just protect against a bad value
            }

            //update the element with the value that should be shown in the input
            $(element).val(
                modelValue && inputValueProp !== valueProp ? unwrap(modelValue[inputValueProp]) : modelValue.toString()
            );
        }
    };

    ko.bindingHandlers.jqAutoCombo = {
        init: function(element, valueAccessor) {
            var autoEl = $('#' + valueAccessor());

            $(element).click(function() {
                // close if already visible
                if (autoEl.autocomplete('widget').is(':visible')) {
                    console.log('close');
                    autoEl.autocomplete('close');
                    return;
                }

                //autoEl.blur();
                console.log('search');
                autoEl.autocomplete('search', ' ');
                autoEl.focus();
            });
        }
    };

    ko.bindingHandlers.visibleAndSelect = {
        update: function(element, valueAccessor) {
            ko.bindingHandlers.visible.update(element, valueAccessor);
            if (valueAccessor()) {
                setTimeout(function() {
                    $(element)
                        .find('input')
                        .focus()
                        .select();
                }, 0); //new tasks are not in DOM yet
            }
        }
    };

    let viewModel = new AppViewModel();
    viewModel.currentConfig().sourceport.subscribe(data => {
        viewModel.chooseSourceport(data);
        viewModel.loadAllCommandLineOptions();
        viewModel.loadDMFlags();
    });
    viewModel.currentConfig().iwad.subscribe(data => {
        viewModel.loadLevels();
        viewModel.loadSkillLevels();
    });
    viewModel.chosenPreviousConfig.subscribe(data => {
        viewModel.loadPreviousConfig();
    });

    ko.applyBindings(viewModel);
});
// This is a simple *viewmodel* - JavaScript that defines the data and behavior of your UI
