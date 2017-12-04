// Native
const os = require('os')
const path = require('path')
const url = require('url')

// Packages
const electron = require('electron')
const {autoUpdater} = require('electron-updater')
const isDev = require('electron-is-dev')
const fixPath = require('fix-path')
const { resolve: resolvePath } = require('app-root-path')
const ejse = require('ejs-electron')
const {config} = require('datahub-client')
const ua = require('universal-analytics')
const firstRun = require('first-run')

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
const validate = require('./utils/validate')

// Load the app instance from electron
const { app } = electron

let visitor
if (!isDev) {
  // Setup GA - if user is logged in then use his/her id, otherwise use auto-generated one:
  const userId = config.get('profile') ? config.get('profile').id : config.get('id')
  if (userId) {
    visitor = ua('UA-80458846-6', userId, {strictCidFormat: false})
  } else {
    visitor = ua('UA-80458846-6')
  }

  // Setup Sentry for main process:
  const Raven = require('raven')
  Raven.config('https://fafe5a09a4ff43d6a69b8d4163790ae4:c349dd6a453143bb8f35f25e585b019f@sentry.io/253155', {
    captureUnhandledRejections: true,
    tags: {
      process: process.type,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      platform: os.platform(),
      platform_release: os.release()
    }
  }).install()
} else {
  // Stub object for dev env:
  visitor = {event: (a, b) => {
    return {send: () => {}}
  }}
}

// Set the application's name
app.setName('Data')

// Makes sure where inheriting the correct path
// Within the bundled app, the path would otherwise be different
fixPath()

// If this is the first run then track with GA:
if (!isDev && firstRun()) {
  visitor.event('Events', 'First run').send()
}

// Notify user when the app update is donwloaded:
autoUpdater.on('update-downloaded', (info) => {
  // Track it with GA:
  visitor.event('Events', 'App auto updated').send()
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

  // Function for handling dropped files:
  const filesDropped = async (event, files) => {
    event.preventDefault()

    if (process.env.CONNECTION === 'offline') {
      showError("You're offline")
      return
    }

    // Check if user is logged in. If so proceed, if not require to login:
    config.setup()
    if (!config.get('token')) {
      // Track it with GA:
      visitor.event('Events', 'File dropped but not logged in').send()
      toggleWindow(null, windows.login, tray)
      return
    }
    // Track as successful file drop with GA:
    visitor.event('Events', 'File dropped successfully').send()
    await showcase(files)
  }

  // Define major event listeners for tray
  tray.on('drop-files', filesDropped)
  tray.on('click', toggleActivity)
  tray.on('double-click', toggleActivity)

  // Check for electron app updates only if not in development:
  if (!isDev) {
    autoUpdater.checkForUpdates()
  }

  // Listen which window to toggle from renderer:
  electron.ipcMain.on('toggle-window', (event, win) => {
    toggleWindow(null, windows[win], tray)
  })

  // Listen for login requests:
  electron.ipcMain.on('login-request', async (event) => {
    if (isDev) console.log('login in now...')
    const result = await login()
    // Track login with GA:
    if (result.success) {
      visitor.event('Events', 'Logged in successfully').send()
    } else {
      visitor.event('Events', 'Error on login').send()
    }
    if (isDev) console.log('Login success: ' + result.success)
  })

  // Listen for push requests:
  electron.ipcMain.on('push-request', async (event, originalPath, descriptor) => {
    if (isDev) console.log('commencing push...')
    // Track push requests with GA:
    visitor.event('Events', 'Push requested').send()
    const result = await push(originalPath, descriptor)

    if (result.loggedIn) {
      if (isDev) console.log('push done! URL: ' + result.url)
      // Track successful push with GA:
      visitor.event('Events', 'Successfully pushed').send()
      // Send back url to renderer:
      event.sender.send('published-url', result.url)
    } else { // If not logged in then open login window:
      toggleWindow(null, windows.login, tray)
    }
  })

  // Listen for validate requests:
  electron.ipcMain.on('validate', async (event, resources) => {
    if (isDev) console.log('validating...')
    // Track validation request with GA:
    visitor.event('Events', 'Validation request').send()
    const validatedResources = await validate(resources)
    event.sender.send('validation-results', validatedResources)
    if (isDev) console.log('validation process finished.')
  })
})
