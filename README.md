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
2. lokijs - use the concept of a "default config" and a "current config".  let the user's session be "current config", and if they make a new config, then simply copy the "default config" to the user's "current config".
3. dmFlag addition logic (allow users to search for flags, and add them to a "pool" of configurations)
   1. one list (searchable) of the available configs, each one with a tooltip that displays the full description.  
   2. click the plus button to add it to the pool of dmflag configs (and remove it from the choosable list)
   3. the configuration pool will list all dmflags, each has a minus button to remove them and put them back in the choosable list).
   4. Searchability: typing something makes it grab from the lokijs database based on what you type (much like the search feature in file database).  Since the only input is "on/off", create each entry as a "DMFlag" object.  In the html, instead of a "checkbox", make it a button (much like the show/hide button in file database) that changes its css depending on whether "enabled" is true.  the button: onclick - change that object's boolean value to the opposite and update lokijs (no need to reload).
4. pwad adding/removing and load order.
   1. Searchable: typing something makes it grab from the lokijs database based on what you type (much like the search feature in file database).  Let each one get created as a new PWad(values...), but - create function to test whether pwad is in already chosen pwads, if true, then don't add it to the list of "newPwads".  Do a `self.chosenPwads.removeAll()`, followed by a `self.chosenPwads.push.apply(self.chosenPwads, newPwads);`
   2. Each found pwad will be listed, each one with a checkbox and a plus button (plus adds that one pwad to the playlist and removes it from the list, checkboxes are for when you click "add selected", again, same as above - adds to playlist and removes from select list).
   3. Chosen Pwad list will need minus buttons to remove them and put them back in the Choosable pwad list.  checkboxes to remove all selected.
   4. Chosen Pwad list can be reordered.  The only way that makes any sense is to make 'em draggable.
5. Command line configs
   1. Make it look like vscode's settings view
   2. searchable - utilize lokijs to "search" for an option
   3. each config has a boolean "on/off" value, but some have a value you can type in.  the load order doesn't matter, so no need to include them in a "chosen configs" array like pwads are in.
   4. treat them like dmFlags - instead of a checkbox, make it a button that changes css class.
   5. type field determines what kind of option it is.
      1. boolean - simple on or off, no need to render an input field
      2. text - text input box
      3. number - use html5 "number" input type
      4. range - numeric input restriction using a html5 "range" and "number" input box, make both point to the same field.  Use the valueRange object to get the min and max.
      5. select - input type is select, and options are determined by the 'valueset' array field.  valueset is an array of object that have 'text' and 'value' fields.
      6. file - input type is 'file', allows you to select a file via text input or via "browse"
      7. files - same as file, except include the "multiple" attribute
   6. place all configs into clickable category menu titles.
6. ~~Map Config - Autosuggest a level based on the iwad chosen (subtype field).  Use this as a guideline: <http://jsfiddle.net/rniemeyer/MJQ6g/>~~Completed!
7. store configurations
8. clone configurations
9. export configurations as batch file (choose relative paths or absolute paths)

### Chocolate-Doom Specific

1. create chocolate-doom pwad and deh constructor (it's different than zdoom-based mods... yay old-school?)
2. ~~allow user to specify game version from preselected versions~~Part of the main config database
3. create 3-screen implementation
