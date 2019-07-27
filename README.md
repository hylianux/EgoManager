# Ego Manager

Yet another Doom launcher

## What is it/Why should I use it?

This launcher differs from other launchers in 3 ways.

1. It's portable.  If you like keeping all of your Doom files on a thumb drive, the configurations will work no matter what computer you plug this into.  *This is my* ***Doom*** *stick*!
2. It helps build a command line.  Some people still prefer .bat files, and that's ok.  I'm not forcing you to run the game only through my app.  Simply scroll to the bottom and you'll see the command-line output of what it's building.  You can copy/paste that to a .bat file of your choice (particularly useful if you're trying to create easy launch options for something like, say, Launchbox).
3. It creates sanity for your files.  The File Manager portion of the app might be tedious, but a modder can make your life easier by including a .json file with their mod, and the app will load it automatically.  The main reason this part exists is not only to add the ability to search for files or know what crazy .wad filenames are supposed to represent, but also to give credit to the creators of those files.  

## Installation and Setup

Download the [latest version](https://github.com/hylianux/EgoManager/releases), and, optionally, [some premade catalogue files](https://github.com/hylianux/EgoManager/releases/download/v0.1-beta/Extra.Metadata.7z).  There is no *installation* per se - just extract and you're ready to go.

Once everything is extracted, open the idTech folder and copy over your iwads, pwads, and souceports (yes, keep your sourceports in their respective folders when you copy them over, this app was designed entirely with that in mind).

Now you're ready to run the application.  Double-click EgoManager.exe and off you go.

> This also has a "debug mode" as well... run the app from a command line with the -dev parameter to activate it.

### Cataloguing Files

You should definitely catalogue your files.  The premade catalogue files have all the .json files of metadata for the known official Iwads and the 3 sourceports this launcher was designed for.  You can extract that to your iwads/sourceports directories and that should help speed up all the cataloguing.  

### Building a Command Chain

Select a sourceport, then an iwad, then go crazy with all the options you can set for running a game.  Save/load configurations for easy access later, or, if you still prefer using bat files, then you can copy and paste the generated command at the bottom to your own .bat file.  My launcher is flexible enough to give you what you need to run the game your own way.

## Build Instructions

After cloning or downloading the repository, simply run:
`npm install`

### Running the app

* `npm start` to start the app (by default, it runs in "dev mode")
  * subsequent runs of the application should be run with `npm run electron-start` unless you need a perfectly clean environment again.
* `npm run build-exe` to export the app as an executable
  * you can run the app in dev mode by running EgoManager.exe with the -dev parameter
* `npm run build-package` to build, export as an executable, AND archive the whole thing in a nice neat little .7z file.

## For Modders

Hey, do you want your mod to load into EgoManager easily?  Simply include a .json file with the below details.

Property | Description
---|---
filename|nameOfWad.wad or nameOfWad.pk3.  What filename is your mod connected to?
authors|an array of author strings.  For example, Doom's authors would be ["John Carmack", "John Romero", "Adrian Carmack", "Tom Hall", "Sandy Peterson", "American McGee"]
metaTags|An array of strings.  What tags would you give your mod?  Something to search by.
source|Either a company name, or even better - a url of where the mod came from.
name|A human readable name for your mod... For example, "HQPSXMUS.WAD" is impossible to comprehend the meaning of, but "PSX soundtrack replacement (High Quality)" tells me exactly what it is
quickDescription|A quick 1-2 sentence description of your mod... this will show up as a tooltip when people hover over it.
longDescription|Go nuts, this can be as long as you want... put a changelog in there, put a long-winded description, it doesn't matter.
