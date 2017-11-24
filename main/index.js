// Native
const path = require('path')
const url = require('url')

// Packages
const electron = require('electron')
const {autoUpdater} = require('electron-updater')
const isDev = require('electron-is-dev')
const fixPath = require('fix-path')
const { resolve: resolvePath } = require('app-root-path')
const ejse = require('ejs-electron')

// Utils
const { version } = require('../package')
const windowList = require('./utils/frames/list')
const toggleWindow = require('./utils/frames/toggle')
const updater = require('./updates')
const showcase = require('./utils/showcase')
const notify = require('./notify')
const handleException = require('./utils/exception')
const { error: showError } = require('./dialogs')
const login = require('./utils/login')
const push = require('./utils/push')

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

// Function for handling dropped files:
const filesDropped = async (event, files) => {
  event.preventDefault()

  if (process.env.CONNECTION === 'offline') {
    showError("You're offline")
    return
  }

  await showcase(files)
}

// Chrome Command Line Switches
app.commandLine.appendSwitch('disable-renderer-backgrounding')

// Prevent garbage collection
// Otherwise the tray icon would randomly hide after some time
let tray = null

// Set ejs to debug mode if in dev env:
// if (isDev) {
//   ejse.options('debug', true)
// }

app.on('ready', async () => {
  const onlineStatusWindow = new electron.BrowserWindow({
    width: 0,
    height: 0,
    show: false
  })

  onlineStatusWindow.loadURL(
    'file://' + resolvePath('./main/pages/status.ejs')
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
  const { mainWindow, tutorialWindow, loginWindow } = windowList

  // And then put it back into a list :D
  const windows = {
    main: mainWindow(tray),
    tutorial: tutorialWindow(tray),
    login: loginWindow(tray)
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
  tray.on('drop-files', filesDropped)
  tray.on('click', toggleActivity)
  tray.on('double-click', toggleActivity)

  // Check for electron app updates only if not in development:
  if (!isDev) {
    autoUpdater.checkForUpdates()
  }

  // Listen for login requests:
  electron.ipcMain.on('login-request', async (event) => {
    if (isDev) console.log('login in now...')
    await login()
    if (isDev) console.log('login done')
  })

  // Listen for push requests:
  electron.ipcMain.on('push-request', async (event, originalPath) => {
    if (isDev) console.log('commencing push...')
    const result = await push(originalPath)

    if (result.loggedIn) {
      if (isDev) console.log('push done! URL: ' + result.url)
      // Send back url to renderer:
      event.sender.send('published-url', result.url)
    } else { // If not logged in then open login window:
      toggleWindow(null, windows.login, tray)
    }
  })
})
