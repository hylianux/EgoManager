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
2. dmFlag addition logic (allow users to search for flags, and add them to a "pool" of configurations)
   1. one list (searchable) of the available configs, each one with a tooltip that displays the full description.  
   2. click the plus button to add it to the pool of dmflag configs (and remove it from the choosable list)
   3. the configuration pool will list all dmflags, each has a minus button to remove them and put them back in the choosable list).
   4. Searchability: typing something makes it grab from the lokijs database based on what you type (much like the search feature in file database).  Let each one get created as a new DMFlag(values...), but - create function to test whether dmflag is in already chosen dmflags, if true, then don't add it to the list of "newDMFlags".  Do a `self.chosenDMFlags.removeAll()`, followed by a `self.chosenDMFlags.push.apply(self.chosenDMFlags, newDMFlags);`
3. pwad adding/removing and load order.
   1. Searchable: typing something makes it grab from the lokijs database based on what you type (much like the search feature in file database).  Let each one get created as a new PWad(values...), but - create function to test whether pwad is in already chosen pwads, if true, then don't add it to the list of "newPwads".  Do a `self.chosenPwads.removeAll()`, followed by a `self.chosenPwads.push.apply(self.chosenPwads, newPwads);`
   2. Each found pwad will be listed, each one with a checkbox and a plus button (plus adds that one pwad to the playlist and removes it from the list, checkboxes are for when you click "add selected", again, same as above - adds to playlist and removes from select list).
   3. Chosen Pwad list will need minus buttons to remove them and put them back in the Choosable pwad list.  checkboxes to remove all selected.
   4. Chosen Pwad list can be reordered.  The only way that makes any sense is to make 'em draggable.
4. Command line parameters (these are not on/off in nature, so care needs to go into how these will be implemented)
5. store configurations
6. clone configurations
7. export configurations as batch file (choose relative paths or absolute paths)

### Chocolate-Doom Specific

1. create chocolate-doom pwad and deh constructor (it's different than zdoom-based mods... yay old-school?)
2. allow user to specify game version from preselected versions
3. create 3-screen implementation