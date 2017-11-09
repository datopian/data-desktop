// Native
const path = require('path')
const url = require('url')
const { homedir } = require('os')

// Packages
const {ipcMain} = require('electron')
const isDev = require('electron-is-dev')
const ms = require('ms')
const semVer = require('semver')
const trimWhitespace = require('trim')
const exists = require('path-exists')
const { exec } = require('child-process-promise')

// Utilities
const { version } = require('../package')
const notify = require('./notify')
const binaryUtils = require('./utils/binary')

const localBinaryVersion = async () => {
  // We need to modify the `cwd` to prevent the app itself (Now.exe) to be
  // executed on Windows. On other platforms this shouldn't produce side effects.
  const fullPath = binaryUtils.getFile()
  const cmd = await exec(`${fullPath} --version`, { cwd: homedir() })

  if (!cmd.stdout) {
    throw new Error('Not version tag received from `now -v`')
  }

  // Make version tag parsable
  const output = trimWhitespace(cmd.stdout.toString())

  if (semVer.valid(output)) {
    return output
  }
}


const updateBinary = async (win) => {
  if (process.env.CONNECTION === 'offline') {
    return
  }

  const fullPath = binaryUtils.getFile()
  if (isDev) {
    console.log('Full path to local binary file: ' + fullPath)
  }

  console.log('Checking for binary updates at remote...')
  const remote = await binaryUtils.getURL()

  if (await exists(fullPath)) {
    const currentRemote = remote.version
    const currentLocal = await localBinaryVersion()

    if (isDev) {
      console.log('Current remote version: ' + currentRemote)
      console.log('Current local version: ' + currentLocal)
    }

    // Force an update if "data --version" fails
    if (currentLocal) {
      const comparison = semVer.compare(currentLocal, currentRemote)

      if (comparison !== -1) {
        // Notify user that no updates available
        win.webContents.send('binaryUpdate', {currentLocal})
        console.log('No updates found for binary')
        return
      }
      // Notify user what is current version and what will be downloaded:
      win.webContents.send('binaryUpdate', {currentLocal, currentRemote})
      console.log('Found an update for binary! Downloading...')
    }
  } else {
    // Notify user that binary is not found locally so it'll be installed
    win.webContents.send('binaryUpdate', {})
    console.log('No binary exists locally. Installing the binary...')
  }

  const updateFile = await binaryUtils.download(remote.url, remote.binaryName, (percantage) => {
    win.webContents.send('progress', percantage)
  })

  // Check if the binary is working before moving it into place
  try {
    await binaryUtils.testBinary(updateFile.path)
  } catch (err) {
    console.log('The downloaded binary is broken')
    updateFile.cleanup()

    throw err
  }

  // Make sure there's no existing binary in the way
  await binaryUtils.handleExisting(updateFile.path)

  // Remove temporary directory that contained the update
  updateFile.cleanup()

  // Check the version of the installed binary
  const newVersion = await localBinaryVersion()

  notify({
    title: 'Updated DataHub CLI to Version ' + newVersion,
    body:
      'Feel free to try it in your terminal or click to see what has changed!',
    url: 'https://github.com/datahq/datahub-cli/releases/tag/v' + newVersion
  })
}


const startBinaryUpdates = (win) => {
  const binaryUpdateTimer = time =>
    setTimeout(async () => {
      try {
        await updateBinary(win)
        if (isDev) {
          console.log('Finished binary updates... Next check in 10m')
        }
        setTimeout(() => {
          win.loadURL(url.format({
            pathname: path.join(__dirname, 'pages/done.html'),
            protocol: 'file:',
            slashes: true
          }))
        }, 3000)
        binaryUpdateTimer(ms('10m'))
      } catch (err) {
        console.log(err)
        win.loadURL(url.format({
          pathname: path.join(__dirname, 'pages/error.html'),
          protocol: 'file:',
          slashes: true
        }))
        binaryUpdateTimer(ms('1m'))
      }
    }, time)

  binaryUpdateTimer(ms('2s'))
}


module.exports = (win) => {
  if (process.platform === 'linux') {
    return
  }

  if (isDev) {
    console.log('Starting binary updates...')
  }

  startBinaryUpdates(win)
}
