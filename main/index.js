// Native
const path = require('path')
const url = require('url')

// Packages
const electron = require('electron')
const {autoUpdater} = require('electron-updater')
const isDev = require('electron-is-dev')
const fixPath = require('fix-path')
const { resolve: resolvePath } = require('app-root-path')

// Utils
const { version } = require('../package')
const windowList = require('./utils/frames/list')
const toggleWindow = require('./utils/frames/toggle')
const updater = require('./updates')
const notify = require('./notify')
const handleException = require('./utils/exception')

// Load the app instance from electron
const { app } = electron

// Set the application's name
app.setName('Data')

// Makes sure where inheriting the correct path
// Within the bundled app, the path would otherwise be different
fixPath()

// Notify user when the app update is donwloaded:
autoUpdater.on('update-downloaded', (info) => {
  notify({
    title: 'New Data-Desktop is ready!',
    body: 'Quit and open the app to start using the latest version!'
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Chrome Command Line Switches
app.commandLine.appendSwitch('disable-renderer-backgrounding')

// Prevent garbage collection
// Otherwise the tray icon would randomly hide after some time
let tray = null

app.on('ready', async () => {
  const onlineStatusWindow = new electron.BrowserWindow({
    width: 0,
    height: 0,
    show: false
  })

  onlineStatusWindow.loadURL(
    'file://' + resolvePath('./main/static/pages/status.html')
  )


  electron.ipcMain.on('online-status-changed', (event, status) => {
    process.env.CONNECTION = status
  })

  try {
    tray = new electron.Tray(resolvePath(`./main/static/tray/iconTemplate.png`))
  } catch (err) {
    handleException(err)
    return
  }

  // Opening the context menu after login should work
  global.tray = tray

  // Extract each window out of the list
  const { mainWindow, tutorialWindow } = windowList

  // And then put it back into a list :D
  const windows = {
    main: mainWindow(tray),
    tutorial: tutorialWindow(tray)
  }

  updater(windows.main)

  // Make the window instances accessible from everywhere
  global.windows = windows

  const toggleActivity = async event => {
    toggleWindow(event || null, windows.main, tray)
    return
  }

  // Only allow one instance of Now running
  // at the same time
  const shouldQuit = app.makeSingleInstance(toggleActivity)

  if (shouldQuit) {
    return app.exit()
  }

  if (!windows.main.isVisible()) {
    windows.main.once('ready-to-show', toggleActivity)
    // TODO: remove this part once about page is implemented:
    windows.main.once('ready-to-show', () => {
      const appVersion = isDev ? version : app.getVersion()
      windows.main.webContents.send('version', appVersion)
    })
  }

  // Define major event listeners for tray
  tray.on('click', toggleActivity)
  tray.on('double-click', toggleActivity)

  // Check for electron app updates only if not in development:
  if (!isDev) {
    autoUpdater.checkForUpdates()
  }
})
