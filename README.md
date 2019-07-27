# Ego Manager

Yet another Doom launcher

## Installation and Setup

Download the [latest version](https://github.com/hylianux/EgoManager/releases), and, optionally, [some premade catalogue files](https://github.com/hylianux/EgoManager/releases/download/v0.1-beta/Extra.Metadata.7z).  There is no *installation* per se - just extract and you're ready to go.

Once everything is extracted, open the idTech folder and copy over your iwads, pwads, and souceports (yes, keep your sourceports in their respective folders when you copy them over, this app was designed entirely with that in mind).

Now you're ready to run the application.  Double-click EgoManager.exe and off you go.

> This also has a "debug mode" as well... run the app from a command line with the -dev parameter to activate it.

### Cataloguing Files

You should definitely catalogue your files.  The premade catalogue files haveall the .json files of metadata for the known official Iwads and the 3 sourceports this launcher was designed for (and you can also find it under the latest beta release).  You can extract that to your iwads/sourceports directories and that should help speed up all the cataloguing.  

### Building a Command Chain

Select a sourceport, then an iwad, then go crazy with all the options you can set for running a game.  Save/load configurations for easy access later, or, if you still prefer using bat files, then you can copy and paste the generated command at the top to your own .bat file.  My launcher is flexible enough to give you what you need to run the game your own way.

## Build Instructions

After cloning or downloading the repository, simply run:
`npm install`

### Running the app

* `npm start` to start the app (by default, it runs in "dev mode")
  * subsequent runs of the application should be run with `npm run electron-start` unless you need a perfectly clean environment again.
* `npm run build-exe` to export the app as an executable
  * you can run the app in dev mode by running EgoManager.exe with the -dev parameter
* `npm run build-package` to build, export as an executable, AND archive the whole thing in a nice neat little .7z file.
