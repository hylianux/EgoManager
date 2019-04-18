# Ego Manager

Yet another Doom launcher

## Build Instructions

After cloning or downloading the repository, simply run:
`npm install`

## Running the app

* `npm start` to start the app (by default, it runs in "dev mode")
* `npm run build-exe` to export the app as an executable
* `npm run build-package` to build, export as an executable, AND archive the whole thing in a nice neat little .7z file.

## Still to do

### Configuration Builder

1. If sourceport is of known type (GZDoom, Zandronum, Chocolate Doom), add extra UI for determining options specific to that sourceport.
2. dmFlag addition logic
3. pwad adding/removing and load order (needs design on how best to approach this)
4. store configurations
5. clone configurations
6. export configurations as batch file (choose relative paths or absolute paths)

### Chocolate-Doom Specific
1. create chocolate-doom pwad and deh constructor (it's different than zdoom-based mods... yay old-school?)
2. allow user to specify game version from preselected versions
3. create 3-screen implementation