# Ego Manager

Yet another Doom launcher

## Build Instructions

After cloning or downloading the repository, simply run:
`npm install`

## Running the app

* `npm start` to start the app (by default, it runs in "dev mode")
* `npm run build-exe` to export the app as an executable
  * you can run the app in dev mode by running EgoManager.exe with the -dev parameter
* `npm run build-package` to build, export as an executable, AND archive the whole thing in a nice neat little .7z file.

## Using the app

1. Extract everything.
1. Open the idTech folder, and place all your sourceports, iwads, and pwads in the respective folders.
1. Run the application.

### Cataloguing Files

You should definitely catalogue your files.  I've included a [zipped file](https://github.com/hylianux/EgoManager/releases/download/v0.1-beta/Extra.Metadata.7z) with all the .json files of metadata for the known official Iwads and the 3 sourceports this launcher was designed for (and you can also find it under the latest beta release).  You can extract that to your iwads/sourceports directories and that should help speed up all the cataloguing.  

### Building a Command Chain

Select a sourceport, then an iwad, then go crazy with all the options you can set for running a game.  Save/load configurations for easy access later, or, if you still prefer using bat files, then you can copy and paste the generated command at the top to your own .bat file.  My launcher is flexible enough to give you what you need to run the game your own way.
