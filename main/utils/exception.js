// Packages
const { app } = require('electron')
const serializeError = require('serialize-error')
const fetch = require('node-fetch')
const isDev = require('electron-is-dev')

// Utilities
const userAgent = require('./user-agent')

module.exports = async error => {
  let errorParts = {}

  if (typeof error === 'string') {
    errorParts.name = 'Error'
    errorParts.message = 'An error occured'
    errorParts.stack = error
  } else {
    // Make the error sendable using GET
    errorParts = serializeError(error)
  }

  // Log the error to the console
  console.error(errorParts)

  // Restart the app, so that it doesn't continue
  // running in a broken state
  if (!isDev) {
    app.relaunch()
  }

  app.exit(0)
}
