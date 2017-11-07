// Native
const path = require('path')
const url = require('url')

// Packages
const electron = require('electron')
const {autoUpdater} = require('electron-updater')
const log = require('electron-log')
const fixPath = require('fix-path')
const { resolve: resolvePath } = require('app-root-path')

// Utils
const updater = require('./updates')

// Load the app instance from electron
const { app } = electron

// Set the application's name
app.setName('Data')

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

// Makes sure where inheriting the correct path
// Within the bundled app, the path would otherwise be different
fixPath()

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Chrome Command Line Switches
app.commandLine.appendSwitch('disable-renderer-backgrounding')

autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Checking for update...');
})
autoUpdater.on('update-available', (info) => {
  sendStatusToWindow('Update available.');
})
autoUpdater.on('update-not-available', (info) => {
  sendStatusToWindow('Update not available.');
})
autoUpdater.on('error', (err) => {
  sendStatusToWindow('Error in auto-updater. ' + err);
})
autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  sendStatusToWindow(log_message);
})
autoUpdater.on('update-downloaded', (info) => {
  sendStatusToWindow('Update downloaded');
});

app.on('ready', async () => {
  const mainWindow = new electron.BrowserWindow({})
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'pages/home.html'),
    protocol: 'file:',
    slashes: true
  }))

  electron.ipcMain.on('online-status-changed', (event, status) => {
    process.env.CONNECTION = status
  })

  updater(mainWindow)
})

app.on('ready', async () => {
  await autoUpdater.checkForUpdatesAndNotify()
})
