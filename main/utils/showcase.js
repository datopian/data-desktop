// Native
const path = require('path')

// Packages
const electron = require('electron')
const ejse = require('ejs-electron')
const fs = require('fs-extra')
const {Dataset, File} = require('data.js')
const hri = require('human-readable-ids').hri
const { resolve: resolvePath } = require('app-root-path')

// Utils
const { error: showError } = require('../dialogs')
const toggleWindow = require('./frames/toggle')


const prepareDatasetFromFile = async filePath => {
  const pathParts = path.parse(filePath)
  const file = await File.load(pathParts.base, {basePath: pathParts.dir})

  // List of formats that are known as tabular
  const knownTabularFormats = ['csv', 'tsv', 'dsv']
  if (knownTabularFormats.includes(file.descriptor.format)) {
    await file.addSchema()
  }

  let dpName, dpTitle
  dpName = file.descriptor.name.replace(/\s+/g, '-').toLowerCase()
  // Add human readable id so that this packge does not conflict with other
  // packages (name is coming from the file name which could just be
  // data.csv)
  dpName += '-' + hri.random()

  // Make unslugifies version for title:
  dpTitle = dpName.replace(/-+/g, ' ')
  dpTitle = dpTitle.charAt(0).toUpperCase() + dpTitle.slice(1)

  const metadata = {
    name: dpName,
    title: dpTitle,
    resources: []
  }
  const dataset = await Dataset.load(metadata)
  dataset.addResource(file)
  return dataset
}


module.exports = async (files) => {
  if (files.length === 1) {
    const path_ = files[0]
    if (fs.lstatSync(path_).isFile()) {
      const pathParts = path.parse(path_)
      if (pathParts.base === 'datapackage.json') {
        showError('Sorry, currently you can drop in a single file. Data Package support is coming!')
      }
      const dataset = await prepareDatasetFromFile(path_)
      ejse.data('dataset', dataset.descriptor)
      ejse.data('dpId', JSON.stringify(dataset.descriptor).replace(/\\/g, '\\\\').replace(/\'/g, "\\'"))
      const win = new electron.BrowserWindow({
        width: 800,
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
