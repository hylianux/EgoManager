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
1. lokijs - use the concept of a "default config" and a "current config".  let the user's session be "current config", and if they make a new config, then simply copy the "default config" to the user's "current config".
1. store configurations
1. clone configurations
1. export configurations as batch file (choose relative paths or absolute paths)

### Chocolate-Doom Specific

1. create chocolate-doom pwad and deh constructor (it's different than zdoom-based mods... yay old-school?)
1. create 3-screen implementation
