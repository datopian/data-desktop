// Native
const path = require('path')
const url = require('url')

// Packages
const electron = require('electron')
const appAutoUpdater = require("electron-updater").autoUpdater
const fixPath = require('fix-path')
const { resolve: resolvePath } = require('app-root-path')

// Utils
const autoUpdater = require('./updates')

// Load the app instance from electron
const { app } = electron

// Set the application's name
app.setName('Data')

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

  appAutoUpdater.checkForUpdatesAndNotify()

  autoUpdater(mainWindow)
})
