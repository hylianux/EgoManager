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


function AppViewModel() {
    let self = this;

    self.nodeVersion = process.versions.node;
    self.chromeVersion = process.versions.chrome;
    self.electronVersion = process.versions.electron;
    self.idTechFolder = path.resolve(__dirname, '../../idTech');
    self.iwadDirectory = self.idTechFolder + path.sep + 'iwads';
    self.pwadDirectory = self.idTechFolder + path.sep + 'pwads';
    self.sourceportDirectory = self.idTechFolder + path.sep + 'sourceports';

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
    self.loadCollections = () => {
        self.buildPwadCollection();
        self.buildIwadCollection();
        self.buildSourceportCollection();
    };
    self.reloadFiles = () => {
        console.log('reloading');
        self.loadIwadFiles();
        self.loadPwadFiles();
        self.loadSourceportFiles();
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
                                            console.log('file read error!' + err);
                                        } else {
                                            let sourceport = JSON.parse(data);
                                            upsert(sourceportCollection, 'filename', sourceport);
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
    };
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
        }
        self.iwads.removeAll();
        if (newIwads.length > 0) {
            self.iwads.push.apply(self.iwads, newIwads);
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
        }
        self.sourceports.removeAll();
        if (newSourceports.length > 0) {
            self.sourceports.push.apply(self.sourceports, newSourceports);
        }
    };

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

    self.init = () => {
        //self.goToView(self.views[0]);
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
        //menu: null,
        icon: 'ego.ico'
    });
    /* eslint-enable no-new */
    $('[data-toggle="tooltip"]').tooltip(); 
    // Activates knockout.js

    ko.applyBindings(new AppViewModel());
});
// This is a simple *viewmodel* - JavaScript that defines the data and behavior of your UI
