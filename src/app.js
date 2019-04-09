const { app, BrowserWindow } = require('electron');
const url = require('url');
const path = require('path');

let args = require('minimist')(process.argv);

let win = null;

function createWindow() {
    win = new BrowserWindow({
        width: 1280,
        height: 1024,
        darkTheme: true,
        webPreferences: { nodeIntegration: true },
        frame: false,
        thickFrame: true,
        useContentSize: true
    });
    win.loadURL(
        url.format({
            pathname: path.join(__dirname, './index.html'),
            protocol: 'file',
            slashes: true
        })
    );
    if (args.dev || args.d) {
        win.webContents.openDevTools({ mode: 'bottom' });
    }

    win.on('closed', () => {
        win = null;
    });
}
app.on('ready', createWindow);

app.on('browser-window-created', (e, window) => {
    window.setMenu(null);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (win === null) {
        createWindow();
    }
});
