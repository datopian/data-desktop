const {DataHub} = require('datahub-client')
const {config} = require('datahub-client')
const {authenticate} = require('datahub-client')
const {Dataset, isDataset, isUrl} = require('data.js')
const isDev = require('electron-is-dev')
const urljoin = require('url-join')

const prepareDatasetFromFile = require('./prepare')
const { error: showError } = require('../dialogs')


module.exports = async (path_) => {
  const returnObj = {
    loggedIn: null,
    url: null,
    errors: []
  }
  // First check if user is authenticated
  const apiUrl = config.get('api')
  const token = config.get('token')
  let out
  try {
    out = await authenticate(apiUrl, token)
  } catch (err) {
    showError(err)
    return
  }
  if (!out.authenticated) {
    showError('You need to login in order to push your data.')
    returnObj.loggedIn = false
    return returnObj
  } else {
    returnObj.loggedIn = true
  }

  try {
    let dataset
    if (isDataset(path_)) {
      if (isUrl(path_)) {
        showError('Error: You can push only local datasets.')
        return returnObj
      }
      dataset = await Dataset.load(path_)
    } else {
      dataset = await prepareDatasetFromFile(path_)
    }

    const datahubConfigs = {
      apiUrl: config.get('api'),
      token: config.get('token'),
      debug: isDev ? true : false,
      ownerid: config.get('profile') ? config.get('profile').id : config.get('id'),
      owner: config.get('profile') ? config.get('profile').username : config.get('username')
    }

    const datahub = new DataHub(datahubConfigs)
    const options = {
      findability: 'published'
    }
    await datahub.push(dataset, options)

    returnObj.url = urljoin(config.get('domain'), datahubConfigs.owner, dataset.descriptor.name)
    return returnObj
  } catch (err) {
    showError(err)
    console.log('> [debug]\n' + err.stack)
    return returnObj
  }
}
