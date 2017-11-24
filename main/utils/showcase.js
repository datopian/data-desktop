// Native
const path = require('path')

// Packages
const electron = require('electron')
const ejse = require('ejs-electron')
const fs = require('fs-extra')
const {Dataset} = require('data.js')
const { resolve: resolvePath } = require('app-root-path')
const toArray = require('stream-to-array')

// Utils
const prepareDatasetFromFile = require('./prepare')
const { error: showError } = require('../dialogs')
const toggleWindow = require('./frames/toggle')
const {dpInReadme, textToMarkdown, makeSmallReadme} = require('./markdown')


module.exports = async (files) => {
  if (files.length === 1) {
    const path_ = files[0]
    if (fs.lstatSync(path_).isFile()) {
      // If it is "datapackage.json" then use it, otherwise generate one from data file:
      const pathParts = path.parse(path_)
      let dataset
      if (pathParts.base === 'datapackage.json') {
        dataset = await Dataset.load(path_)
      } else {
        dataset = await prepareDatasetFromFile(path_)
      }
      // Making a copy of dp to use in the compiled README
      const initialDp = Object.assign({}, dataset.descriptor)
      // Add previews for CSV files:
      dataset.descriptor.views = dataset.descriptor.views || []
      dataset.descriptor.resources.forEach(resource => {
        if (resource.format === 'csv') {
          const preview = {
            "datahub": {
              "type": "preview"
            },
            "resources": [resource.name],
            "specType": "table"
          }
          dataset.descriptor.views.push(preview)
        }
      })
      // Add base path:
      dataset.descriptor.path = path_.replace('/datapackage.json', '')
      // Make resources with inlined data so we don't need `fs` module in browser:
      for (let i = 0; i < dataset.resources.length; i++) {
        if (dataset.resources[i].descriptor.format === 'csv') {
          const rows = await dataset.resources[i].rows()
          dataset.descriptor.resources[i].data = await toArray(rows)
        } else {
          const buffer = await dataset.resources[i].buffer
          dataset.descriptor.resources[i].data = JSON.parse(buffer.toString())
        }
      }
      // If readme exists then convert md to html:
      if (dataset.descriptor.readme) {
        const readmeCompiled = dpInReadme(dataset.descriptor.readme, initialDp)
        dataset.descriptor.readmeHtml = textToMarkdown(readmeCompiled)
        dataset.descriptor.readmeSnippet = makeSmallReadme(dataset.descriptor.readme)
      }
      // Set variables for rendering the showcase page:
      ejse.data('dataset', dataset.descriptor)
      ejse.data('dpId', JSON.stringify(dataset.descriptor).replace(/\\/g, '\\\\').replace(/\'/g, "\\'"))
      ejse.data('originalPath', path_)
      // Initialize and toggle the window:
      const win = new electron.BrowserWindow({
        width: 1000,
        height: 700,
        title: 'Welcome to DataHub',
        resizable: false,
        center: true,
        frame: false,
        show: false,
        fullscreenable: false,
        maximizable: false,
        titleBarStyle: 'hidden-inset',
        webPreferences: {
          backgroundThrottling: false,
          devTools: true
        }
      })
      win.loadURL('file://' + resolvePath('./main/pages/showcase.ejs'))
      toggleWindow(null, win)
    } else {
      showError('Sorry, currently you can drop in a single file. Directory support is coming!')
    }
  } else if (files.length > 1) {
    showError('Sorry, currently you can drop in a single file. Multiple files support is coming!')
  }
}
