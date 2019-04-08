const ko = require('knockout');
const path = require('path');
const fs = require('fs');
const titlebar = require('custom-electron-titlebar');
const Loki = require('lokijs');
const _ = require('lodash');
const async = require('async');
const pwadTypes = ['wad', 'pk3', 'deh', 'bex'];
const iwadTypes = ['wad', 'pk3'];

function getCollection(collectionName) {
    let collection = db.getCollection(collectionName);
    if (!collection) {
        collection = db.addCollection(collectionName);
    }
    return collection;
}

let db = new Loki(path.resolve(__dirname, '../../ego.json'), {
    autosave: true,
    env: 'NODEJS'
});
let iwadCollection = getCollection('iwads');
let pwadCollection = getCollection('pwads');
let sourceportCollection = getCollection('sourceports');
let sourceportConfigCollection = getCollection('sourceportConfigs');
// let configurations = getCollection('configurations');

/**
 * Performs an upsert.
 * This means performing an update if the record exists, or performing an
 * insert if it doesn't.
 * LokiJS (as at version 1.2.5) lacks this function.
 * TODO: Remove this function when LokiJS has built-in support for upserts.
 * @param {object} collection - The target DB collection.
 * @param {string} idField - The field which contains the record's unique ID.
 * @param {object} record - The record to be upserted.
 * @depends lodash
 */
function upsert(collection, idField, record) {
    let query = {};
    query[idField] = record[idField];
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

function SeatReservation(name, initialMeal) {
    var self = this;
    self.name = name;
    self.meal = ko.observable(initialMeal);
    self.formattedPrice = ko.computed(function() {
        var price = self.meal().price;
        return price ? '$' + price.toFixed(2) : 'None';
    });
}
/*
let pwad = {
    filename: file,
    authors: [''],
    metaTags: [''],
    source: '',
    name: '',
    quickDescription: '',
    longDescription: ''
};
*/

function Iwad(filename, authors, metaTags, source, name, quickDescription, longDescription) {
    var self = this;
    self.filename = filename;
    self.authors = authors;
    self.metaTags = metaTags;
    self.source = source;
    self.name = name;
    self.quickDescription = quickDescription;
    self.longDescription = longDescription;
    self.error = ko.computed(() => {
        if (!self.filename || !self.authors || !self.source) {
            return true;
        } else {
            return false;
        }
    });
    self.warning = ko.computed(() => {
        if (!self.metaTags || !self.name || !self.quickDescription) {
            return true;
        } else {
            return false;
        }
    });
    self.displayName = ko.computed(() => {
        let displayname = '';
        if (!self.name) {
            if (!self.filename) {
                displayname = '';
            } else {
                displayname = self.filename;
            }
        } else {
            displayname = self.name;
        }
        return displayname;
    });
}
function Pwad(filename, authors, metaTags, source, name, quickDescription, longDescription) {
    var self = this;
    self.filename = filename;
    self.authors = authors;
    self.metaTags = metaTags;
    self.source = source;
    self.name = name;
    self.quickDescription = quickDescription;
    self.longDescription = longDescription;
    self.error = ko.computed(() => {
        if (!self.filename || !self.authors || !self.source) {
            return true;
        } else {
            return false;
        }
    });
    self.warning = ko.computed(() => {
        if (!self.metaTags || !self.name || !self.quickDescription) {
            return true;
        } else {
            return false;
        }
    });
    self.displayName = ko.computed(() => {
        let displayname = '';
        if (!self.name) {
            if (!self.filename) {
                displayname = '';
            } else {
                displayname = self.filename;
            }
        } else {
            displayname = self.name;
        }
        return displayname;
    });
}
function Sourceport(filename, authors, metaTags, source, name, quickDescription, longDescription) {
    var self = this;
    self.filename = filename;
    self.authors = authors;
    self.metaTags = metaTags;
    self.source = source;
    self.name = name;
    self.quickDescription = quickDescription;
    self.longDescription = longDescription;
    self.error = ko.computed(() => {
        if (!self.filename || !self.authors || !self.source) {
            return true;
        } else {
            return false;
        }
    });
    self.warning = ko.computed(() => {
        if (!self.metaTags || !self.name || !self.quickDescription) {
            return true;
        } else {
            return false;
        }
    });
    self.displayName = ko.computed(() => {
        let displayname = '';
        if (!self.name) {
            displayname = self.filename;
        } else {
            displayname = self.name;
        }
        return displayname;
    });
}
function SourceportConfig(
    filename,
    authors,
    metaTags,
    source,
    name,
    quickDescription,
    longDescription,
    sourceportName
) {
    var self = this;
    self.filename = filename;
    self.authors = authors;
    self.metaTags = metaTags;
    self.source = source;
    self.name = name;
    self.quickDescription = quickDescription;
    self.longDescription = longDescription;
    self.sourceportName = sourceportName;
    self.displayName = ko.computed(() => {
        if (!self.name) {
            return self.sourceportName + '-' + self.filename;
        } else {
            return self.soureportName + '-' + self.name;
        }
    });
    self.error = ko.computed(() => {
        if (!self.filename || !self.authors || !self.source || !self.sourceportName) {
            return true;
        } else {
            return false;
        }
    });
    self.warning = ko.computed(() => {
        if (!self.metaTags || !self.name || !self.quickDescription) {
            return true;
        } else {
            return false;
        }
    });
    self.displayName = ko.computed(() => {
        let displayname = '';
        if (self.sourceportName) {
            displayname += self.sourceportName + '-';
        }
        if (!self.name) {
            displayname += self.filename;
        } else {
            displayname += self.name;
        }
        return displayname;
    });
}

function AppViewModel() {
    let self = this;

    self.nodeVersion = process.versions.node;
    self.chromeVersion = process.versions.chrome;
    self.electronVersion = process.versions.electron;
    self.idTechFolder = path.resolve(__dirname, '../../idTech');
    self.iwadDirectory = self.idTechFolder + '/iwads';
    self.pwadDirectory = self.idTechFolder + '/pwads';
    self.sourceportDirectory = self.idTechFolder + '/sourceports';

    self.files = ko.observableArray();
    /*
                        let pwad = {
                                filename: file,
                                filepath: fullPath,
                                authors: [''],
                                metaTags: [''],
                                source: '',
                                name: '',
                                quickDescription: '',
                                longDescription: ''
                            };
                            */

    self.pwads = ko.observableArray();
    self.iwads = ko.observableArray();
    self.sourceports = ko.observableArray();
    self.sourceportConfigs = ko.observableArray();
    self.loadCollections = () => {
        self.buildPwadCollection();
        self.buildIwadCollection();
        self.buildSourceportCollection();
    };
    self.reloadFiles = () => {
        console.log('reloading');
        self.loadIwadFiles();
        self.loadPwadFiles();
        self.loadSourceports();
    };

    self.loadSourceports = () => {
        self.loadSourceportFiles();
        self.loadSourceportConfigFiles();
    };

    self.loadIwadFiles = () => {
        let allIwads = iwadCollection.find();
        let newIwads = [];
        _.forEach(allIwads, iwad => {
            let newIwad = new Iwad(
                iwad.filename,
                iwad.authors,
                iwad.metaTags,
                iwad.source,
                iwad.name,
                iwad.quickDescription,
                iwad.longDescription
            );
            newIwads.push(newIwad);
        });
        self.iwads.removeAll();
        self.iwads.push.apply(self.iwads, newIwads);
    };

    self.loadPwadFiles = () => {
        let allPwads = pwadCollection.find();
        let newPwads = [];
        _.forEach(allPwads, pwad => {
            let newPwad = new Pwad(
                pwad.filename,
                pwad.authors,
                pwad.metaTags,
                pwad.source,
                pwad.name,
                pwad.quickDescription,
                pwad.longDescription
            );
            newPwads.push(newPwad);
        });
        self.pwads.removeAll();
        self.pwads.push.apply(self.pwads, newPwads);
    };
    self.loadSourceportFiles = () => {
        let allSourceports = sourceportCollection.find();
        let newSourceports = [];
        _.forEach(allSourceports, sourceport => {
            let newSourceport = new Sourceport(
                sourceport.filename,
                sourceport.authors,
                sourceport.metaTags,
                sourceport.source,
                sourceport.name,
                sourceport.quickDescription,
                sourceport.longDescription
            );
            newSourceports.push(newSourceport);
        });
        self.sourceports.removeAll();
        self.sourceports.push.apply(self.sourceports, newSourceports);
    };
    self.loadSourceportConfigFiles = () => {
        let allSourceportConfigs = sourceportConfigCollection.find();
        let newSourceportConfigs = [];
        _.forEach(allSourceportConfigs, sourceportConfig => {
            let newSourceportConfig = new SourceportConfig(
                sourceportConfig.filename,
                sourceportConfig.authors,
                sourceportConfig.metaTags,
                sourceportConfig.source,
                sourceportConfig.name,
                sourceportConfig.quickDescription,
                sourceportConfig.longDescription,
                sourceportConfig.sourceportName
            );
            newSourceportConfigs.push(newSourceportConfig);
        });
        self.sourceportConfigs.removeAll();
        self.sourceportConfigs.push.apply(self.sourceportConfigs, newSourceportConfigs);
    };

    self.buildPwadCollection = () => {
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
                                console.log('buildPwad:: ' + file + 'is directory: ' + fullPath);
                                walk(fullPath);
                            } else {
                                let fileExt = file.substring(file.lastIndexOf('.') + 1);

                                if (pwadTypes.indexOf(fileExt) > -1) {
                                    let pwad = {
                                        filename: file,
                                        filepath: fullPath
                                    };
                                    upsert(pwadCollection, 'filename', pwad);
                                } else if (fileExt === 'json') {
                                    fs.readFile(fullPath, 'utf8', (err, data) => {
                                        if (err) {
                                            console.log('file read error!' + err);
                                        } else {
                                            let pwad = JSON.parse(data);
                                            upsert(pwadCollection, 'filename', pwad);
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
                                                pwadCollection.update(pwad);
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

    self.buildIwadCollection = () => {
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
                                console.log('buildIwad:: ' + file + 'is directory: ' + fullPath);
                                walk(fullPath);
                            } else {
                                let fileExt = file.substring(file.lastIndexOf('.') + 1);

                                if (iwadTypes.indexOf(fileExt) > -1) {
                                    let iwad = {
                                        filename: file,
                                        filepath: fullPath
                                    };
                                    upsert(iwadCollection, 'filename', iwad);
                                } else if (fileExt === 'json') {
                                    fs.readFile(fullPath, 'utf8', (err, data) => {
                                        if (err) {
                                            console.log('file read error!' + err);
                                        } else {
                                            let iwad = JSON.parse(data);
                                            upsert(iwadCollection, 'filename', iwad);
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
                                                iwadCollection.update(iwad);
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

    self.buildSourceportCollection = () => {
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
                                console.log('buildSourceport:: ' + file + 'is directory: ' + fullPath);
                                walk(fullPath);
                            } else {
                                let fileExt = file.substring(file.lastIndexOf('.') + 1);

                                if (fileExt === 'exe') {
                                    let sourceport = {
                                        filename: file,
                                        filepath: fullPath
                                    };
                                    upsert(sourceportCollection, 'filename', sourceport);
                                } else if (fileExt === 'json') {
                                    fs.readFile(fullPath, 'utf8', (err, data) => {
                                        if (err) {
                                            console.log('error loading file!' + err);
                                        } else {
                                            let object = JSON.parse(data);
                                            let objectFileExt = object.filename.substring(file.lastIndexOf('.') + 1);
                                            if (objectFileExt === 'exe') {
                                                upsert(sourceportCollection, 'filename', object);
                                            } else if (objectFileExt === 'ini') {
                                                upsert(sourceportConfigCollection, 'filename', object);
                                            }
                                        }
                                    });
                                } else if (fileExt === 'ini') {
                                    let sourceportConfig = {
                                        filename: file,
                                        filepath: fullPath
                                    };
                                    if (sourceportConfigCollection.find({ filename: file }).length < 1) {
                                        sourceportConfig.sourceportName = path
                                            .dirname(fullPath)
                                            .split(path.sep)
                                            .pop();
                                    }
                                    upsert(sourceportConfigCollection, 'filename', sourceportConfig);
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
    self.sourceportConfigSearch = ko.observable();

    self.findIwad = () => {
        let result = iwadCollection.where(obj => {
            let containsName = obj.name.indexOf(self.iwadSearch()) > -1;
            let containsFilename = obj.filename.indexOf(self.iwadSearch()) > -1;
            let containsMetaTag = () => {
                let doesContain = false;
                _.forEach(obj.metaTags, tag => {
                    if (!doesContain) {
                        doesContain = tag.indexOf(self.iwadSearch());
                    }
                });
                return doesContain;
            };
            let containsAuthor = () => {
                let doesContain = false;
                _.forEach(obj.authors, author => {
                    if (!doesContain) {
                        doesContain = author.indexOf(self.iwadSearch());
                    }
                });
                return doesContain;
            };
            let containsSource = obj.source.indexOf(self.iwadSearch());
            let containsQuickDescription = obj.quickDescription.indexOf(self.iwadSearch());
            let containsLongDescription = obj.longDescription.indexOf(self.iwadSearch());
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
        return result;
    };
    self.findPwad = () => {
        if (self.pwadSearch() && self.pwadSearch().trim() != '') {
            let text = self.pwadSearch().toUpperCase();
            let result = pwadCollection.where(obj => {
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
            let newPwads = [];
            if (result && result.length > 0) {
                _.forEach(result, pwad => {
                    let newPwad = new Pwad(
                        pwad.filename,
                        pwad.authors,
                        pwad.metaTags,
                        pwad.source,
                        pwad.name,
                        pwad.quickDescription,
                        pwad.longDescription
                    );
                    newPwads.push(newPwad);
                });
            }
            self.pwads.removeAll();
            if (newPwads.length > 0) {
                self.pwads.push.apply(self.pwads, newPwads);
            }
        }
    };
    /*
    self.walk = directoryName => {
        fs.readdir(directoryName, (e, files) => {
            if (e) {
                console.log('Error: ', e);
                return;
            }
            files.forEach(file => {
                var fullPath = path.join(directoryName, file);
                fs.stat(fullPath, (e, f) => {
                    if (e) {
                        console.log('Error: ', e);
                        return;
                    }
                    if (f.isDirectory()) {
                        console.log(fullPath);
                        self.walk(fullPath);
                    } else {
                        self.files.push(fullPath);
                        self.files.sort();
                        console.log(fullPath);
                    }
                });
            });
        });
    };
    */
    // self.walk(self.idTechFolder);
    // this is example code for first/last name editing
    self.firstName = ko.observable('Bert');
    self.lastName = ko.observable('Bertington');
    self.fullName = ko.computed(function() {
        return self.firstName() + ' ' + self.lastName();
    }, self);

    self.capitalizeLastName = function() {
        let currentVal = self.lastName(); // Read the current value
        self.lastName(currentVal.toUpperCase()); // Write back a modified value
    };

    // this is example code for seat reservation/todo management
    // Non-editable catalog data - would come from the server
    self.availableMeals = [
        { mealName: 'Standard (sandwich)', price: 0 },
        { mealName: 'Premium (lobster)', price: 34.95 },
        { mealName: 'Ultimate (whole zebra)', price: 290 }
    ];

    // Editable data
    self.seats = ko.observableArray([
        new SeatReservation('Steve', self.availableMeals[0]),
        new SeatReservation('Bert', self.availableMeals[0])
    ]);
    // Operations
    self.addSeat = function() {
        self.seats.push(new SeatReservation('', self.availableMeals[0]));
    };
    self.removeSeat = function(seat) {
        self.seats.remove(seat);
    };

    self.totalSurcharge = ko.computed(function() {
        var total = 0;
        for (var i = 0; i < self.seats().length; i++) total += self.seats()[i].meal().price;
        return total;
    });
    // and here's code for "single-page application" example
    self.views = [
        'Configuration Builder',
        'File Database',
        'info',
        'Knockout Name Example',
        'Knockout Seat Reservation Example',
        'Knockout Mail Inbox',
        'Knockout Mail Archive'
    ];
    self.chosenViewId = ko.observable();
    self.chosenViewData = ko.observable();

    self.goToView = view => {
        self.chosenViewId(view);
        if (view == self.views[1]) {
            self.reloadFiles();
        }
        // simulation of "getting" data
        self.chosenViewData(mail[view]);
    };

    // http://learn.knockoutjs.com/mail?folder=Inbox

    self.init = () => {
        self.goToView(self.views[0]);
        console.log('loading files');
        self.loadCollections();
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
ready(function() {
    /* this was fun, but seriously, no
    document.querySelectorAll('body')[0].addEventListener('click', function () {
        document.bgColor = 'red';
    });
    */
    /**
     * let's activate the titlebar so we can close this bad boy
     */
    /* eslint-disable no-new */
    new titlebar.Titlebar({
        backgroundColor: titlebar.Color.fromHex('#000'),
        // menu: null,
        icon: 'ego.ico'
    });
    /* eslint-enable no-new */
    // Activates knockout.js
    ko.applyBindings(new AppViewModel());
});
// This is a simple *viewmodel* - JavaScript that defines the data and behavior of your UI

const mail = {
    'Knockout Mail Inbox': {
        id: 'Inbox',
        mails: [
            {
                id: 1,
                from: 'Abbot \u003coliver@smoke-stage.xyz\u003e',
                to: 'steve@example.com',
                date: 'May 25, 2011',
                subject: 'Booking confirmation #389629244',
                folder: 'Inbox'
            },
            {
                id: 2,
                from: 'Addison Begoat \u003cupton.oprdrusson@pear-income.xyz\u003e',
                to: 'steve@example.com',
                date: 'May 7, 2011',
                subject: 'FW: Associate advice',
                folder: 'Inbox'
            },
            {
                id: 3,
                from: 'Allistair \u003cleroy72@plane-railway.xyz\u003e',
                to: 'steve@example.com',
                date: 'May 19, 2011',
                subject: 'RE: Phone call tomorrow 5 o\u0027clock',
                folder: 'Inbox'
            },
            {
                id: 4,
                from: 'emmanuel26@ghost.xyz',
                to: 'steve@example.com',
                date: 'May 22, 2011',
                subject: 'Completing basketball project',
                folder: 'Inbox'
            },
            {
                id: 5,
                from: 'jamalia.alnismith1@twigdad.xyz',
                to: 'steve@example.com',
                date: 'Apr 26, 2011',
                subject: 'FW: Can you get DE to resubmit accounts?',
                folder: 'Inbox'
            },
            {
                id: 6,
                from: 'lionel.qugy@cribsmoke.xyz',
                to: 'steve@example.com',
                date: 'May 22, 2011',
                subject: 'RE: Catch up at 9:00 to finalise rain spec',
                folder: 'Inbox'
            },
            {
                id: 7,
                from: 'Madison Lalinesson \u003cmelinda.gofagy@wing-language2.xyz\u003e',
                to: 'steve@example.com',
                date: 'May 19, 2011',
                subject: 'RE: Pencil scenarios',
                folder: 'Inbox'
            },
            {
                id: 8,
                from: 'rajah.nukripyford@cast92.xyz',
                to: 'steve@example.com',
                date: 'Apr 28, 2011',
                subject: 'Flavor benefit gig',
                folder: 'Inbox'
            },
            {
                id: 9,
                from: 'Sandra Juanhison \u003cyoshi.mostaline72@facefruit.xyz\u003e',
                to: 'steve@example.com',
                date: 'May 8, 2011',
                subject: 'RE: Apparel5 network is back up',
                folder: 'Inbox'
            },
            {
                id: 10,
                from: 'Sylvester \u003crose.va@bunpig98.xyz\u003e',
                to: 'steve@example.com',
                date: 'May 1, 2011',
                subject: 'Feedback requested by Ayanna Nuyo',
                folder: 'Inbox'
            },
            {
                id: 11,
                from: 'veronica@heart.xyz',
                to: 'steve@example.com',
                date: 'May 4, 2011',
                subject: 'Project Book starting 6pm',
                folder: 'Inbox'
            },
            {
                id: 12,
                from: 'XLN \u003cbasia@framehome.xyz\u003e',
                to: 'steve@example.com',
                date: 'May 8, 2011',
                subject: 'RE: Remember Whoopi\u0027s joke',
                folder: 'Inbox'
            }
        ]
    },
    'Knockout Mail Archive': {
        id: 'Archive',
        mails: [
            {
                id: 13,
                from: 'adele.guyuson@hat-chicken6.xyz',
                to: 'steve@example.com',
                date: 'May 2, 2011',
                subject: 'RE: Reservation confirmation #999331516',
                folder: 'Archive'
            },
            {
                id: 14,
                from: 'blair@pleasure-cactus77.xyz',
                to: 'steve@example.com',
                date: 'May 24, 2011',
                subject: 'Project Sky  - your job is 9pm',
                folder: 'Archive'
            },
            {
                id: 15,
                from: 'brennan@lake.xyz',
                to: 'steve@example.com',
                date: 'May 20, 2011',
                subject: 'RE: Car9 network is out of service',
                folder: 'Archive'
            },
            {
                id: 16,
                from: 'BYLB \u003ctravis98@downtown28.xyz\u003e',
                to: 'steve@example.com',
                date: 'May 20, 2011',
                subject: 'RE: Pear tactics',
                folder: 'Archive'
            },
            {
                id: 17,
                from: 'catherine85@fanhope14.xyz',
                to: 'steve@example.com',
                date: 'May 6, 2011',
                subject: 'Meet with Camilla',
                folder: 'Archive'
            },
            {
                id: 18,
                from: 'channing11@moon26.xyz',
                to: 'steve@example.com',
                date: 'May 13, 2011',
                subject: 'Meeting at 9am',
                folder: 'Archive'
            },
            {
                id: 19,
                from: 'clio.gucysmith@pailmountain.xyz',
                to: 'steve@example.com',
                date: 'May 2, 2011',
                subject: 'Your order P815875237 has dispatched',
                folder: 'Archive'
            },
            {
                id: 20,
                from: 'erich.grizajuson7@volleyball-icicle.xyz',
                to: 'steve@example.com',
                date: 'May 23, 2011',
                subject: 'Reservation confirmation #439756385',
                folder: 'Archive'
            },
            {
                id: 21,
                from: 'fitzgerald.togoag@bike.xyz',
                to: 'steve@example.com',
                date: 'May 24, 2011',
                subject: 'Feedback requested by Bradley Vasedrismith',
                folder: 'Archive'
            },
            {
                id: 22,
                from: 'harriet1@pear-daughter.xyz',
                to: 'steve@example.com',
                date: 'Apr 30, 2011',
                subject: 'RE: Hall server is back up',
                folder: 'Archive'
            },
            {
                id: 23,
                from: 'Ila \u003craja@quiet.xyz\u003e',
                to: 'steve@example.com',
                date: 'May 14, 2011',
                subject: 'RE: Your order A435146969 is delayed',
                folder: 'Archive'
            },
            {
                id: 24,
                from: 'Kareem Wyeson \u003canne56@crayon21.xyz\u003e',
                to: 'steve@example.com',
                date: 'May 16, 2011',
                subject: 'FW: Straw diagrams',
                folder: 'Archive'
            },
            {
                id: 25,
                from: 'keith2@hope.xyz',
                to: 'steve@example.com',
                date: 'May 14, 2011',
                subject: 'Operation Island finished',
                folder: 'Archive'
            },
            {
                id: 26,
                from: 'lev.vopiyosson@dirt-crown.xyz',
                to: 'steve@example.com',
                date: 'May 3, 2011',
                subject: 'RE: DB Replication ending now',
                folder: 'Archive'
            },
            {
                id: 27,
                from: 'melinda.atla@string-hall94.xyz',
                to: 'steve@example.com',
                date: 'May 18, 2011',
                subject: 'have clinic appt at 5:45',
                folder: 'Archive'
            },
            {
                id: 28,
                from: 'Richard \u003cfiona2@wrench.xyz\u003e',
                to: 'steve@example.com',
                date: 'May 4, 2011',
                subject: 'Beam5 network is back up',
                folder: 'Archive'
            },
            {
                id: 29,
                from: 'sean.mayel@string37.xyz',
                to: 'steve@example.com',
                date: 'May 7, 2011',
                subject: 'Feedback requested by Dawn Pytosson',
                folder: 'Archive'
            },
            {
                id: 30,
                from: 'Simone \u003croary@bushes.xyz\u003e',
                to: 'steve@example.com',
                date: 'May 9, 2011',
                subject: 'RE: Does Nolan know C#?',
                folder: 'Archive'
            },
            {
                id: 31,
                from: 'thaddeus.tregube5@butter coast.xyz',
                to: 'steve@example.com',
                date: 'May 18, 2011',
                subject: 'RE: Remember Chava\u0027s brother',
                folder: 'Archive'
            },
            {
                id: 32,
                from: 'zenia.dayson@pail-apparel8.xyz',
                to: 'steve@example.com',
                date: 'May 11, 2011',
                subject: 'RE: Reviewing VHD demo',
                folder: 'Archive'
            }
        ]
    }
};
