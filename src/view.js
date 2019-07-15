'use strict';
const ko = require('knockout');
const path = require('path');
const fs = require('fs');
const titlebar = require('custom-electron-titlebar');
const Datastore = require('nedb');
const _ = require('lodash');
const pwadTypes = ['wad', 'pk3', 'deh', 'bex'];
const iwadFileTypes = ['wad', 'pk3'];
// Importing this adds a right-click menu with 'Inspect Element' option
const { remote } = require('electron');
const { Menu, MenuItem } = remote;
const { exec } = require('child_process');
const publicIp = require('public-ip');
let args = require('minimist')(remote.process.argv);
let dev = args.dev || args.d;
let rightClickPosition = null;


// this only shows up in dev mode
// it was designed for debugging so i could easily jump to an element on the page in the developer console.
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


//TODO: CHOCOLATE DOOM multi-screen command
//chocolate-doom -server -window & chocolate-doom -autojoin -left -window & chocolate-doom -autojoin -right -window



//TODO: create custom commands for WAD merging in chocolate doom

// These are all the collections loaded from the nedb databases
let iwadCollection = new Datastore({ filename: path.resolve(__dirname, '../../iwads.db'), autoload: true });
let pwadCollection = new Datastore({ filename: path.resolve(__dirname, '../../pwads.db'), autoload: true });
let sourceportCollection = new Datastore({ filename: path.resolve(__dirname, '../../sourceports.db'), autoload: true });
let configCollection = new Datastore({ filename: path.resolve(__dirname, '../../configs.db'), autoload: true });
let previousConfigCollection = new Datastore({
    filename: path.resolve(__dirname, '../../previousConfigs.db'),
    autoload: true
});
let commandLineCollection = new Datastore({ filename: path.resolve(__dirname, '../../commands.db'), autoload: true });
let DMFlagsCollection = new Datastore({
    filename: path.resolve(__dirname, '../../deathmatchFlags.db'),
    autoload: true
});
let levelsCollection = new Datastore({ filename: path.resolve(__dirname, '../../gameLevels.db'), autoload: true });
let skillLevelsCollection = new Datastore({
    filename: path.resolve(__dirname, '../../gameSkillLevels.db'),
    autoload: true
});


// a config chain is the chain of commands and options needed to run a game.
// it has a sourceport, it has an iwad, it has pwads, added options...
// this is where the generated command comes from
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

    // gets the multiplayer address from the loaded port multiplayer option
    self.usePort = ko.computed(() => {
        let port = 5029;
        if (self.sourceportConfigs){
            _.forEach(self.sourceportConfigs.multiplayer(), config => {
                if (config.command === '-port'){
                    port = config.value();
                }
            });
        }
        return port;
    });

    //this will be generated from the current config chain
    self.generatedCommand = ko.computed(() => {
        let command = '';
        if (self.sourceport()) {
            command += '"' + self.sourceport() + '" ';
        }
        if (self.iwad()) {
            command += '-iwad "' + self.iwad() + '" ';
        }
        if (self.chosenIniFile()) {
            command += '-config "' + self.chosenIniFile() + '" ';
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

// deathmatch flags
// they all have an integer value to them
// simply add up whatever gets enabled, and that becomes the value needed for the dmflag command
function DMFlag(enabled, name, value, description, command, sourceport) {
    let self = this;
    self.enabled = ko.observable(enabled);
    self.name = name;
    self.value = value;
    self.description = description;
    self.command = command;
    self.sourceport = sourceport;
}

// each command line option has to be enabled
// these are loaded from the database
// depending on the type of option, it may already have default data, or an expectation of what kind of data it wants.
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

// everything... pwads, iwads, and sourceports... they're all files.
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
    // this is the only place where things get weird.
    // the basetype is what gets sent to the database backend
    // but, for knockout, i need to know, for example, if it's an iwad, then what kind of iwad is it...
    // is it doom, heretic, hexen, strife?  what kind of iwad is it?  options will change based on this.
    // same thing with sourceport types... zdoom, zandronum, chocolate?  what kind of sourceport is it?
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
}

// ini files are only used by sourceports
// these contain all the extra added options you want the sourceport to load with
function IniFile(filepath, filename) {
    let self = this;
    self.filepath = filepath;
    self.filename = filename;
}

// level 1, level 2?  
// ok, javascript doesn't like the word "map".  it's a reserved word
// the problem is doom games refer to levels as maps
// so any time you want to go to a "map", the word "level" will be used here.
// this function is for dynamically loading level names based on what kind of iwad you chose.
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

// much like how Level worked, skill levels are the difficulty levels.
// hurt me plenty, ultraviolence, nightmare, stuff like that.
// this function exists because each iwad has different text for their skill levels
// this is mostly added for flavor.
function SkillLevel(name, level) {
    let self = this;
    self.name = name;
    self.skillLevel = level;
}

// this is the main brain of the entire application.
// not much to say here, dig in and see the comments for specific things yourself.
function AppViewModel() {
    let self = this;
    // this is all debug stuff
    self.isDebug = dev;
    self.nodeVersion = process.versions.node;
    self.chromeVersion = process.versions.chrome;
    self.electronVersion = process.versions.electron;
    // </debug stuff>
    self.idTechFolder = path.resolve(__dirname, '../../idTech');
    self.iwadDirectory = self.idTechFolder + path.sep + 'iwads';
    self.pwadDirectory = self.idTechFolder + path.sep + 'pwads';
    self.sourceportDirectory = self.idTechFolder + path.sep + 'sourceports';
    self.ip = ko.observable();
    self.chosenFile = ko.observable();
    self.chosenPreviousConfig = ko.observable();
    self.showHiddenFiles = ko.observable(false);
    self.iwadSearch = ko.observable();
    self.pwadSearch = ko.observable();
    self.sourceportSearch = ko.observable();
    self.currentConfig = ko.observable();
    self.configSearch = ko.observable('');

    self.skillLevels = ko.observableArray();
    self.levels = ko.observableArray();
    self.Allfiles = ko.observableArray();
    self.iniFiles = ko.observableArray();
    self.files = {
        iwads: ko.observableArray(),
        pwads: ko.observableArray(),
        sourceports: ko.observableArray()
    };
    self.previousConfigChains = ko.observableArray();
    self.configChains = ko.observableArray();
    self.availablePwads = ko.observableArray();
    self.sourceportTypes = ko.observableArray(['ZDoom', 'Zandronum', 'Chocolate', 'Other']);
    self.gamemodes = ko.observableArray([
        {
            value: 'solo',
            displayText: 'Solo'
        },
        {
            value: 'multiplayer',
            displayText: 'Multiplayer'
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
    // gets the address for anyone hosting a game
    self.multiplayerAddress = ko.computed(() => {
        if (self.currentConfig()){
            return self.ip()+':'+self.currentConfig().usePort();
        } else {
            return '';
        }
    });
    // returns true if and only if all iwads are hidden.
    // used to display special message saying "hey, you might wanna unhide stuff"
    self.iwadsAllHidden = ko.computed(() => {
        let counter = 0;
        _.forEach(self.files.iwads(), iwad => {
            if (iwad.hidden() === true) {
                counter++;
            }
        });
        return counter === self.files.iwads.length;
    });
    // returns true if and only if all pwads are hidden.
    // used to display special message saying "hey, you might wanna unhide stuff"
    self.pwadsAllHidden = ko.computed(() => {
        let counter = 0;
        _.forEach(self.files.pwads(), pwad => {
            if (pwad.hidden() === true) {
                counter++;
            }
        });
        return counter === self.files.pwads.length;
    });
    // returns true if and only if all sourceports are hidden.
    // used to display special message saying "hey, you might wanna unhide stuff"
    self.sourceportsAllHidden = ko.computed(() => {
        let counter = 0;
        _.forEach(self.files.sourceports(), sourceport => {
            if (sourceport.hidden() === true) {
                counter++;
            }
        });
        return counter === self.files.sourceports.length;
    });
    //-------------------------------------------------------------------------
    // all the loading functions for loading stuff from the database
    //-------------------------------------------------------------------------
    // catch-all for loading all collections.
    // convenience function so i only have to call one thing to load everything
    self.loadCollections = reloadFiles => {
        self.buildIwadCollection(reloadFiles);
        self.buildPwadCollection(reloadFiles);
        self.buildSourceportCollection(reloadFiles);
    };
    // loads the iwad database by checking all the iwad files in the idTech/iwads directory
    self.buildIwadCollection = reloadFiles => {
        let directoryName = self.iwadDirectory;
        function walk(directory) {
            fs.readdir(directory, (e, files) => {
                if (e) {
                    console.log('buildIwadCollection error: ', e);
                    return;
                }
                files.forEach(
                    file => {
                        let fullPath = path.join(directory, file);
                        fs.stat(fullPath, (foreachErr, f) => {
                            if (foreachErr) {
                                console.log('buildIwadCollection foreach error: ', foreachErr);
                                return;
                            }
                            if (f.isDirectory()) {
                                if (dev) {
                                    console.log('buildIwad:: ' + file + ' and is directory: ' + fullPath);
                                }
                                walk(fullPath);
                            } else {
                                let fileExt = file.substring(file.lastIndexOf('.') + 1);

                                if (iwadFileTypes.indexOf(fileExt.toLowerCase()) > -1) {
                                    let iwad = {
                                        filename: file,
                                        filepath: fullPath
                                    };
                                    if (dev) {
                                        console.log('buildIwad:: adding ' + fullPath);
                                        console.log('reloadFiles: ' + reloadFiles);
                                    }
                                    iwadCollection.update(
                                        { filename: iwad.filename },
                                        {
                                            $set: {
                                                filepath: iwad.filepath
                                            }
                                        },
                                        { upsert: true },
                                        (updateErr, numReplaced) => {
                                            if (updateErr) {
                                                console.log(
                                                    'buildIwadCollection updatingCollection error: ',
                                                    updateErr
                                                );
                                            } else {
                                                iwadCollection.persistence.compactDatafile();
                                                if (reloadFiles) {
                                                    self.loadIwadFiles();
                                                }
                                            }
                                        }
                                    );
                                } else if (fileExt === 'json') {
                                    fs.readFile(fullPath, 'utf8', (err, data) => {
                                        if (err) {
                                            console.log('buildIwadCollection json file read error!', err);
                                        } else {
                                            let iwad = JSON.parse(data);
                                            if (dev) {
                                                console.log('buildIwad:: adding ' + fullPath);
                                                console.log('reloadFiles: ' + reloadFiles);
                                            }
                                            iwadCollection.update(
                                                { filename: iwad.filename },
                                                {
                                                    $set: {
                                                        authors: iwad.authors,
                                                        metaTags: iwad.metaTags,
                                                        source: iwad.source,
                                                        name: iwad.name,
                                                        quickDescription: iwad.quickDescription,
                                                        longDescription: iwad.longDescription,
                                                        hidden: iwad.hidden,
                                                        basetype: iwad.basetype
                                                    }
                                                },
                                                { upsert: true },
                                                (updateErr, numReplaced) => {
                                                    if (updateErr) {
                                                        console.log(
                                                            'buildIwadCollection updatingCollection with json file error: ',
                                                            updateErr
                                                        );
                                                    } else {
                                                        iwadCollection.persistence.compactDatafile();
                                                        if (reloadFiles) {
                                                            self.loadIwadFiles();
                                                        }
                                                    }
                                                }
                                            );
                                        }
                                    });
                                } else if (fileExt === 'txt') {
                                    iwadCollection.findOne({ filename: f }, (findErr, iwad) => {
                                        if (findErr) {
                                            console.log('buildIwadCollection txt collection.find error: ', findErr);
                                        } else {
                                            fs.readFile(fullPath, 'utf8', (err, data) => {
                                                if (err) {
                                                    console.log('buildIwadCollection txt file read error!', err);
                                                } else {
                                                    let longDescription = data;
                                                    if (iwad && longDescription !== iwad.longDescription) {
                                                        if (dev) {
                                                            console.log(
                                                                'buildIwad:: adding ' +
                                                                    longDescription +
                                                                    ' to ' +
                                                                    fullPath
                                                            );
                                                            console.log('reloadFiles: ' + reloadFiles);
                                                        }
                                                        iwadCollection.update(
                                                            { filename: f },
                                                            { $set: { longDescription: longDescription } },
                                                            {},
                                                            (updateErr, numReplaced) => {
                                                                if (updateErr) {
                                                                    console.log(
                                                                        'buildIwadCollection txt updatingCollection error: ',
                                                                        updateErr
                                                                    );
                                                                } else {
                                                                    iwadCollection.persistence.compactDatafile();
                                                                    if (reloadFiles) {
                                                                        self.loadIwadFiles();
                                                                    }
                                                                }
                                                            }
                                                        );
                                                    }
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    },
                    forErr => {
                        if (forErr) {
                            throw forErr;
                        }
                    }
                );
            });
        }
        walk(directoryName);
    };
    // loads the pwads database by checking all the pwad files in the idTech/pwads directory
    self.buildPwadCollection = reloadFiles => {
        let directoryName = self.pwadDirectory;
        function walk(directory) {
            fs.readdir(directory, (e, files) => {
                if (e) {
                    console.log('buildPwadCollection error:', e);
                    return;
                }
                files.forEach(
                    file => {
                        let fullPath = path.join(directory, file);
                        fs.stat(fullPath, (statErr, f) => {
                            if (statErr) {
                                console.log('buildPwadCollection statError error', statErr);
                                return;
                            }
                            if (f.isDirectory()) {
                                if (dev) {
                                    console.log('buildPwad:: ' + file + ' and is directory: ' + fullPath);
                                }
                                walk(fullPath);
                            } else {
                                let fileExt = file.substring(file.lastIndexOf('.') + 1);

                                if (pwadTypes.indexOf(fileExt.toLowerCase()) > -1) {
                                    let pwad = {
                                        filename: file,
                                        filepath: fullPath
                                    };
                                    if (dev) {
                                        console.log('buildPwad:: adding ' + fullPath);
                                        console.log('reloadFiles: ' + reloadFiles);
                                    }
                                    pwadCollection.update(
                                        { filename: pwad.filename },
                                        { $set: { filepath: pwad.filepath } },
                                        { upsert: true },
                                        (updateErr, numReplaced) => {
                                            if (updateErr) {
                                                console.log('buildPwadCollection updatingCollection error', updateErr);
                                            } else {
                                                pwadCollection.persistence.compactDatafile();
                                                if (reloadFiles) {
                                                    self.loadPwadFiles();
                                                }
                                            }
                                        }
                                    );
                                } else if (fileExt === 'json') {
                                    fs.readFile(fullPath, 'utf8', (err, data) => {
                                        if (err) {
                                            console.log('buildPWadCollection json file read error!', err);
                                        } else {
                                            let pwad = JSON.parse(data);
                                            if (dev) {
                                                console.log('buildPwad:: adding json' + fullPath);
                                                console.log('reloadFiles: ' + reloadFiles);
                                            }
                                            pwadCollection.update(
                                                { filename: pwad.filename },
                                                {
                                                    $set: {
                                                        authors: pwad.authors,
                                                        metaTags: pwad.metaTags,
                                                        source: pwad.source,
                                                        name: pwad.name,
                                                        quickDescription: pwad.quickDescription,
                                                        longDescription: pwad.longDescription,
                                                        hidden: pwad.hidden
                                                    }
                                                },
                                                { upsert: true },
                                                (updateErr, numReplaced) => {
                                                    if (updateErr) {
                                                        console.log(
                                                            'buildPwadCollection updatingCollection json error: ',
                                                            updateErr
                                                        );
                                                    } else {
                                                        pwadCollection.persistence.compactDatafile();
                                                        if (reloadFiles) {
                                                            self.loadPwadFiles();
                                                        }
                                                    }
                                                }
                                            );
                                        }
                                    });
                                } else if (fileExt === 'txt') {
                                    pwadCollection.findOne({ filename: f }, (findErr, pwad) => {
                                        if (findErr) {
                                            console.log('buildPwadCollection findingCollection txt error: ', findErr);
                                        } else {
                                            fs.readFile(fullPath, 'utf8', (err, data) => {
                                                if (err) {
                                                    console.log('buildPwadCollection txt file read error!', err);
                                                } else {
                                                    let longDescription = data;
                                                    if (pwad && longDescription !== pwad.longDescription) {
                                                        if (dev) {
                                                            console.log(
                                                                'buildPwad:: adding ' +
                                                                    longDescription +
                                                                    ' to ' +
                                                                    fullPath
                                                            );
                                                            console.log('reloadFiles: ' + reloadFiles);
                                                        }
                                                        pwadCollection.update(
                                                            { filename: f },
                                                            {
                                                                $set: {
                                                                    longDescription: longDescription
                                                                }
                                                            },
                                                            {},
                                                            (updateErr, numReplaced) => {
                                                                if (updateErr) {
                                                                    console.log(
                                                                        'buildPwadCollection updatingCollection txt error: ',
                                                                        updateErr
                                                                    );
                                                                } else {
                                                                    pwadCollection.persistence.compactDatafile();
                                                                    if (reloadFiles) {
                                                                        self.loadPwadFiles();
                                                                    }
                                                                }
                                                            }
                                                        );
                                                    }
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    },
                    forErr => {
                        if (forErr) {
                            throw forErr;
                        }
                    }
                );
            });
        }
        walk(directoryName);
    };
    // loads the sourceports by checking all the sourceports in the idTech/sourceports directory
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
                        fs.stat(fullPath, (forEachErr, f) => {
                            if (forEachErr) {
                                console.log('buildSourceportCollection stat error: ', forEachErr);
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
                                    sourceportCollection.update(
                                        { filename: sourceport.filename },
                                        {
                                            $set: {
                                                filepath: sourceport.filepath
                                            }
                                        },
                                        { upsert: true },
                                        (updateErr, numReplaced) => {
                                            if (updateErr) {
                                                console.log('buildSourceportCollection update error: ', updateErr);
                                            } else {
                                                sourceportCollection.persistence.compactDatafile();
                                                if (reloadFiles) {
                                                    self.loadSourceportFiles();
                                                }
                                            }
                                        }
                                    );
                                } else if (fileExt === 'json') {
                                    fs.readFile(fullPath, 'utf8', (err, data) => {
                                        if (err) {
                                            console.log('buildSourceportCollection json file read error!', err);
                                        } else {
                                            let sourceport = JSON.parse(data);
                                            if (dev) {
                                                console.log('buildSourceport:: adding ' + fullPath);
                                                console.log('reloadFiles: ' + reloadFiles);
                                            }
                                            sourceportCollection.update(
                                                { filename: sourceport.filename },
                                                {
                                                    $set: {
                                                        authors: sourceport.authors,
                                                        metaTags: sourceport.metaTags,
                                                        source: sourceport.source,
                                                        name: sourceport.name,
                                                        quickDescription: sourceport.quickDescription,
                                                        longDescription: sourceport.longDescription,
                                                        hidden: sourceport.hidden,
                                                        basetype: sourceport.basetype
                                                    }
                                                },
                                                { upsert: true },
                                                (updateErr, numReplaced) => {
                                                    if (updateErr) {
                                                        console.log(
                                                            'buildSourceportCollection update json error: ',
                                                            updateErr
                                                        );
                                                    } else {
                                                        sourceportCollection.persistence.compactDatafile();
                                                        if (reloadFiles) {
                                                            self.loadSourceportFiles();
                                                        }
                                                    }
                                                }
                                            );
                                        }
                                    });
                                }
                            }
                        });
                    },
                    forErr => {
                        if (forErr) {
                            throw forErr;
                        }
                    }
                );
            });
        }
        walk(directoryName);
    };
    // loads iwads from the database into the app's viewmodel, then loads the maps and difficulty's
    self.loadIwadFiles = () => {
        iwadCollection
            .find({})
            .sort({ filename: 1 })
            .exec((err, allIwads) => {
                if (err) {
                    console.log('load iwad files error: ', err);
                } else {
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
                }
            });
    };
    // loads pwads from the database into the app's viewmodel
    // takes the current configuration into account for loading the pwad drag-drop selector
    self.loadPwadFiles = () => {
        pwadCollection
            .find({})
            .sort({ filename: 1 })
            .exec((err, allPwads) => {
                if (err) {
                    console.log('load pwad files error: ', err);
                } else {
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
                }
            });
    };
    // loads sourceports from the database into the app's viewmodel
    self.loadSourceportFiles = () => {
        sourceportCollection
            .find({})
            .sort({ filename: 1 })
            .exec((err, allSourceports) => {
                if (err) {
                    console.log('load sourceportfiles error: ', err);
                } else {
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
                }
            });
    };
    // loads all SAVED config chains from the databse into the app's viewmodel
    self.loadConfigChains = () => {
        configCollection.find({}, (err, allConfigChains) => {
            if (err) {
                console.log('loadConfigChains error: ', err);
            } else {
                if (allConfigChains.length < 1) {
                    self.currentConfig().id(1);
                    self.saveCurrentConfig();
                    self.loadConfigChains();
                }
                let newConfigChains = [];
                _.forEach(allConfigChains, configChain => {
                    let newConfigChain = new ConfigChain(
                        configChain._id,
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
            }
        });
    };
    // loads only the previous configs from the database into the app's viewmodel
    self.loadPreviousConfigChains = () => {
        previousConfigCollection
            .find({})
            .sort({ index: -1 })
            .exec((err, allConfigChains) => {
                if (err) {
                    console.log('loadPreviousConfigChains error: ', err);
                } else {
                    let newConfigChains = [];
                    _.forEach(allConfigChains, configChain => {
                        let newConfigChain = new ConfigChain(
                            configChain._id,
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
                    self.previousConfigChains.push.apply(self.previousConfigChains, newConfigChains);
                }
            });
    };
    // loads all the maps/map names from the database into the app's viewmodel
    // will attempt to take the current config's iwad choice into account for loading the map's names
    // if not available, then will just assume the eXmY AND the mapXY variants, without nice names.
    self.loadLevels = () => {
        self.levels.removeAll();
        let query = null;
        let basetype = null;
        if (self.currentConfig().iwad() != null) {
            let iwad = self.getIwad(self.currentConfig().iwad());
            basetype = iwad.iwadBasetype();
            query = { [basetype]: { $exists: true, $ne: null } };
        }
        levelsCollection
            .find(query)
            .sort({ name: 1 })
            .exec((err, allLevels) => {
                if (err) {
                    console.log('levelsCollection error: ', err);
                } else {
                    let newLevels = [];
                    _.forEach(allLevels, level => {
                        let newLevel = new Level(level, basetype);
                        newLevels.push(newLevel);
                    });
                    if (newLevels.length > 0) {
                        self.levels.push.apply(self.levels, newLevels);
                    }
                }
            });
    };
    // loads all difficulty levels from the database into the app's viewmodel
    // will attempt to take the current config's iwad choice into account for loading the text of the difficulty
    // if not available, will just default to doom's text
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
        skillLevelsCollection.find(query, (err, skillLevelSets) => {
            if (err) {
                console.log('loadSkillLevels error: ', err);
            } else {
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
            }
        });
    };
    // loads all dmflags from the database into the app's viewmodel
    // will take current sourceport into account, otherwise it won't load anything
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
            DMFlagsCollection.find({ sourceport: sourceportType })
                .sort({ value: 1 })
                .exec((err, dmFlags) => {
                    if (err) {
                        console.log('load DMFlags error: ', err);
                    } else {
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
                });
        }
    };
    // loads all command line options from the database into the app's viewmodel
    // will take current sourceport into account, otherwise it won't load anything
    // this is a convenience function to load all the command line options from one function call.
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
    // loads command line options from the database into the app's viewmodel from a given category 
    // (e.g. display, debug, etc.)
    // will take current sourceport into account, otherwise it won't load anything
    // this is a convenience function to load all the command line options from one function call.
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
            query = { category: category, sourceports: sourceportType };
            commandLineCollection.find(query, (err, commandLineOptions) => {
                if (err) {
                    console.log('load Command line options error: ', err);
                } else {
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
            });
        }
    };
    //-------------------------------------------------------------------------
    // All functions for editing files in the file database section
    //-------------------------------------------------------------------------
    // when you click a file in the list on the left side, this is what loads that file's options
    // in the right pane for you to edit.
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
    // every time you click one of the categories "iwads, pwads, sourceports", this basically clears out the right pane
    // whatever file you were looking at, if you click another category, it clears it out for you.
    self.clearFileEdit = () => {
        self.chosenFile(null);
    };
    // this is what gets called every time you click outside of one of the text boxes for editing a file's properties.
    // once initiated, it updates that file's data in the database, then reloads everything.
    // probably a little excessive, but eh, this app's not that big, who cares.
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
                return console.log('update file error: ', err);
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
    // sourceport dropdown calls this function on change
    // this is what kicks off the "getIniFilesForGivenSourceport" function
    self.chooseSourceport = sourceport => {
        if (sourceport) {
            self.getIniFilesForGivenSourceport(sourceport);
        } else {
            self.iniFiles.removeAll();
        }
    };
    // get iwad for given filepath
    // usually utilized to get certain iwad options
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
    // get sourceport for given filepath
    // usually utilized to get certain sourceport options
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
    // uses the sourceport's filepath to look for any ini files contained within the same directory.
    // note: it will not dig into other directories within the sourceport's directory.
    // if you want this app to load your ini file, then you need to put that ini file in the same place as your 
    // sourceport's executable
    // this function will then populate the ini file dropdown on the fly
    self.getIniFilesForGivenSourceport = sourceport => {
        let directory = path.dirname(sourceport);
        self.iniFiles.removeAll();
        function walk(directory) {
            fs.readdir(directory, (e, files) => {
                if (e) {
                    console.log('get ini files for sourceport error: ', e);
                    return;
                }
                files.forEach(
                    file => {
                        let fullPath = path.join(directory, file);
                        fs.stat(fullPath, (forEachErr, f) => {
                            if (forEachErr) {
                                console.log('get ini files for sourceport foreach error: ', forEachErr);
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
    //-------------------------------------------------------------------------
    // here are the search functions for iwads, pwads, and sourceports
    //-------------------------------------------------------------------------
    self.findIwad = () => {
        let handle = iwads => {
            let newIwads = [];
            if (iwads && iwads.length > 0) {
                _.forEach(iwads, iwad => {
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
        if (self.iwadSearch() && self.iwadSearch().trim() != '') {
            let text = self.iwadSearch().toUpperCase();
            iwadCollection
                .find({
                    $where: function() {
                        let containsName = this.name != null && this.name.toUpperCase().indexOf(text) > -1;
                        let containsFilename = this.filename != null && this.filename.toUpperCase().indexOf(text) > -1;
                        let containsMetaTag = () => {
                            let doesContain = false;
                            if (this.metaTags != null) {
                                _.forEach(this.metaTags, tag => {
                                    if (!doesContain) {
                                        doesContain = tag.toUpperCase().indexOf(text) > -1;
                                    }
                                });
                            }
                            return doesContain;
                        };
                        let containsAuthor = () => {
                            let doesContain = false;
                            if (this.authors != null) {
                                _.forEach(this.authors, author => {
                                    if (!doesContain) {
                                        doesContain = author.toUpperCase().indexOf(text) > -1;
                                    }
                                });
                            }
                            return doesContain;
                        };
                        let containsSource = this.source != null && this.source.toUpperCase().indexOf(text) > -1;
                        let containsQuickDescription =
                            this.quickDescription != null && this.quickDescription.toUpperCase().indexOf(text) > -1;
                        let containsLongDescription =
                            this.longDescription != null && this.longDescription.toUpperCase().indexOf(text) > -1;
                        return (
                            containsName ||
                            containsFilename ||
                            containsMetaTag() ||
                            containsAuthor() ||
                            containsSource ||
                            containsQuickDescription ||
                            containsLongDescription
                        );
                    }
                })
                .sort({ filename: 1 })
                .exec((err, iwads) => {
                    if (err) {
                        console.log('findIwad find error: ', err);
                    } else {
                        handle(iwads);
                    }
                });
        } else {
            iwadCollection
                .find({})
                .sort({ filename: 1 })
                .exec((err, iwads) => {
                    if (err) {
                        console.log('findIwad find error: ', err);
                    } else {
                        handle(iwads);
                    }
                });
        }
    };
    self.findPwad = () => {
        let handle = pwads => {
            let newPwads = [];
            if (pwads && pwads.length > 0) {
                _.forEach(pwads, pwad => {
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
        if (self.pwadSearch() && self.pwadSearch().trim() != '') {
            let text = self.pwadSearch().toUpperCase();
            pwadCollection
                .find({
                    $where: function() {
                        let containsName = this.name != null && this.name.toUpperCase().indexOf(text) > -1;
                        let containsFilename = this.filename != null && this.filename.toUpperCase().indexOf(text) > -1;
                        let containsMetaTag = () => {
                            let doesContain = false;
                            if (this.metaTags != null) {
                                _.forEach(this.metaTags, tag => {
                                    if (!doesContain) {
                                        doesContain = tag.toUpperCase().indexOf(text) > -1;
                                    }
                                });
                            }
                            return doesContain;
                        };
                        let containsAuthor = () => {
                            let doesContain = false;
                            if (this.authors != null) {
                                _.forEach(this.authors, author => {
                                    if (!doesContain) {
                                        doesContain = author.toUpperCase().indexOf(text) > -1;
                                    }
                                });
                            }
                            return doesContain;
                        };
                        let containsSource = this.source != null && this.source.toUpperCase().indexOf(text) > -1;
                        let containsQuickDescription =
                            this.quickDescription != null && this.quickDescription.toUpperCase().indexOf(text) > -1;
                        let containsLongDescription =
                            this.longDescription != null && this.longDescription.toUpperCase().indexOf(text) > -1;
                        return (
                            containsName ||
                            containsFilename ||
                            containsMetaTag() ||
                            containsAuthor() ||
                            containsSource ||
                            containsQuickDescription ||
                            containsLongDescription
                        );
                    }
                })
                .sort({ filename: 1 })
                .exec((err, pwads) => {
                    if (err) {
                        console.log('find Pwad error: ', err);
                    } else {
                        handle(pwads);
                    }
                });
        } else {
            pwadCollection
                .find({})
                .sort({ filename: 1 })
                .exec((err, pwads) => {
                    if (err) {
                        console.log('find Pwad error: ', err);
                    } else {
                        handle(pwads);
                    }
                });
        }
    };
    self.findSourceport = () => {
        let handle = sourceports => {
            let newSourceports = [];
            if (sourceports && sourceports.length > 0) {
                _.forEach(sourceports, sourceport => {
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
        if (self.sourceportSearch() && self.sourceportSearch().trim() != '') {
            let text = self.sourceportSearch().toUpperCase();
            sourceportCollection
                .find({
                    $where: function() {
                        let containsName = this.name != null && this.name.toUpperCase().indexOf(text) > -1;
                        let containsFilename = this.filename != null && this.filename.toUpperCase().indexOf(text) > -1;
                        let containsMetaTag = () => {
                            let doesContain = false;
                            if (this.metaTags != null) {
                                _.forEach(this.metaTags, tag => {
                                    if (!doesContain) {
                                        doesContain = tag.toUpperCase().indexOf(text) > -1;
                                    }
                                });
                            }
                            return doesContain;
                        };
                        let containsAuthor = () => {
                            let doesContain = false;
                            if (this.authors != null) {
                                _.forEach(this.authors, author => {
                                    if (!doesContain) {
                                        doesContain = author.toUpperCase().indexOf(text) > -1;
                                    }
                                });
                            }
                            return doesContain;
                        };
                        let containsSource = this.source != null && this.source.toUpperCase().indexOf(text) > -1;
                        let containsQuickDescription =
                            this.quickDescription != null && this.quickDescription.toUpperCase().indexOf(text) > -1;
                        let containsLongDescription =
                            this.longDescription != null && this.longDescription.toUpperCase().indexOf(text) > -1;
                        return (
                            containsName ||
                            containsFilename ||
                            containsMetaTag() ||
                            containsAuthor() ||
                            containsSource ||
                            containsQuickDescription ||
                            containsLongDescription
                        );
                    }
                })
                .sort({ filename: 1 })
                .exec((err, sourceports) => {
                    if (err) {
                        console.log('find sourceport error: ', err);
                    } else {
                        handle(sourceports);
                    }
                });
        } else {
            sourceportCollection
                .find({})
                .sort({ filename: 1 })
                .exec((err, sourceports) => {
                    if (err) {
                        console.log('find sourceport error: ', err);
                    } else {
                        handle(sourceports);
                    }
                });
        }
    };
    //-------------------------------------------------------------------------
    // here are all the config chain functions
    //-------------------------------------------------------------------------
    // this will initialize all configuration options to basically null or blank
    // a fresh slate
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
    // this is for the search function in finding a previously saved config.
    // it doesn't look in "previous configs"
    self.findConfig = () => {
        let handle = configs => {
            let newConfigChains = [];
            if (configs && configs.length > 0) {
                _.forEach(configs, configChain => {
                    let newConfigChain = new ConfigChain(
                        configChain._id,
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
        if (self.configSearch() && self.configSearch().trim() != '') {
            let text = self.configSearch().toUpperCase();
            configCollection
                .find({
                    $where: function() {
                        let containsName = this.configName != null && this.configName.toUpperCase().indexOf(text) > -1;
                        let containsDescription =
                            this.configDescription != null && this.configDescription.toUpperCase().indexOf(text) > -1;
                        let containsIniFile = this.iniFile != null && this.iniFile.toUpperCase().indexOf(text) > -1;
                        let containsIwad = this.iwad != null && this.iwad.toUpperCase().indexOf(text) > -1;
                        let containsGamemode = this.gamemode != null && this.gamemode.toUpperCase().indexOf(text) > -1;
                        let containsSkill =
                            this.skill != null &&
                            this.skill
                                .toString()
                                .toUpperCase()
                                .indexOf(text) > -1;
                        let containsLevel = this.level != null && this.level.toUpperCase().indexOf(text) > -1;
                        let containsPwad = () => {
                            let doesContain = false;
                            if (this.pwads != null) {
                                _.forEach(this.pwads, pwad => {
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
                    }
                })
                .sort({ configName: 1 })
                .exec((err, configs) => {
                    if (err) {
                        console.log('findConfig error', err);
                    } else {
                        handle(configs);
                    }
                });
        } else {
            configCollection
                .find({})
                .sort({ configName: 1 })
                .exec((err, configs) => {
                    if (err) {
                        console.log('findConfig error', err);
                    } else {
                        handle(configs);
                    }
                });
        }
    };
    // this is the function that big blue play button calls
    // it literally runs the generated configuration command
    self.runCurrentConfig = () => {
        let config = ko.mapping.toJS(self.currentConfig);
        previousConfigCollection.find({}, (err, configs) => {
            if (err) {
                console.log('runCurrentConfig error: ', err);
            } else {
                if (configs.length === 50) {
                    previousConfigCollection.remove({ _id: configs[0]._id });
                }
                config.index = configs.length;
                previousConfigCollection.insert(config, (insertErr, newDoc) => {
                    if (insertErr) {
                        console.log('runCurrentConfig insert error: ', insertErr);
                    } else {
                        previousConfigCollection.persistence.compactDatafile();
                        self.loadPreviousConfigChains();
                        exec(self.currentConfig().generatedCommand(), (execErr, stdout, stderr) => {
                            if (execErr) {
                                console.log("couldn't execute the command: ", execErr);
                            }
                            console.log(`stdout: ${stdout}`);
                            console.log(`stdout: ${stderr}`);
                        });
                    }
                });
            }
        });
    };
    // This is what the save button calls
    // this saves the current configuration under the name you specified.
    // if the name already exists, then it overwrites the old one.
    self.saveCurrentConfig = () => {
        let config = ko.mapping.toJS(self.currentConfig);
        config._id = config.id;
        if (!config.configName) {
            config.configName = '[no name]';
        }
        configCollection.update({ _id: config._id }, config, { upsert: true }, (err, numReplaced) => {
            if (err) {
                console.log('saveCurrentConfig error: ', err);
            } else {
                configCollection.persistence.compactDatafile();
                self.loadConfigChains();
            }
        });
    };
    // this is what the delete button calls
    // deletes the current configuration from the database
    self.deleteConfig = config => {
        if (config) {
            let toJS = ko.mapping.toJS(config);
            configCollection.remove({ _id: toJS.id });
            sourceportCollection.persistence.compactDatafile();
            self.loadConfigChains();
        }
    };
    // this is what the clone button calls
    // this will make a copy of a configuration and append " - copy" to the end of its name.
    // it'll immediately load the cloned configuration for you to change
    self.cloneConfig = config => {
        if (config) {
            let newConfig = ko.mapping.toJS(config);
            newConfig.configName = newConfig.configName + ' - copy';
            configCollection.insert(newConfig, (err, someNewConfig) => {
                if (err) {
                    console.log('cloneConfig error: ', err);
                } else {
                    configCollection.persistence.compactDatafile();
                    someNewConfig.id = someNewConfig._id;
                    configCollection.update({ _id: someNewConfig._id }, someNewConfig, {}, (updateErr, numReplaced) => {
                        if (updateErr) {
                            console.log('clone config update error: ', updateErr);
                        } else {
                            configCollection.persistence.compactDatafile();
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
                    });
                }
            });
        }
    };
    // this is what the load button calls
    // loads a previously saved or cloned configuration from the database.
    self.loadConfig = config => {
        if (config) {
            self.chosenPreviousConfig('');
            let query = {};
            query = { _id: config.id() };
            configCollection.findOne(query, (err, newConfig) => {
                if (err) {
                    console.log('loadConfig error: ', err);
                } else {
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
            });
        }
    };
    // this is what the previous configuration dropdown box calls
    // as soon as you select a previous configuration, it loads the configuration from the database.
    self.loadPreviousConfig = () => {
        if (self.chosenPreviousConfig()) {
            previousConfigCollection.findOne({ _id: self.chosenPreviousConfig() }, (err, newConfig) => {
                if (err) {
                    console.log('loadPreviousConfig error: ', err);
                } else {
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
            });
        }
    };
    // the initialization function that starts the whole app going.
    self.init = () => {
        //self.goToView(self.views[0]);
        console.log('init: loading files');
        self.loadCollections(true);
        self.loadDefaultConfig();
        self.loadPreviousConfigChains();
        self.loadConfigChains();
        (async () => {
            self.ip(await publicIp.v4());
        })();
        //TODO: remove this when you can start loading configs from files.
    };
    // this is used by the debug function
    // it's just designed to load all files and display them so you can easily see what files the app can see.
    self.walk = directoryName => {
        fs.readdir(directoryName, (e, files) => {
            if (e) {
                console.log('walk function: ', e);
                return;
            }
            files.forEach(file => {
                let fullPath = path.join(directoryName, file);
                fs.stat(fullPath, (statErr, f) => {
                    if (statErr) {
                        console.log('walk function foreach error: ', statErr);
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
    // here at the end, calling the initialization function.  
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
