const {DataHub} = require('datahub-client')
const {config} = require('datahub-client')
const {authenticate} = require('datahub-client')
const {Dataset, isDataset, isUrl} = require('data.js')
const isDev = require('electron-is-dev')
const urljoin = require('url-join')

const prepareDatasetFromFile = require('./prepare')
const { error: showError } = require('../dialogs')
const notify = require('../notify')


module.exports = async (path_, descriptor, options) => {
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

  if (!isDev) {
    // Show notification that push has started:
    notify({
      title: 'Publishing your dataset',
      body: 'We will notify you once publishing is done.'
    })
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

    // User provided "descriptor" should overwrite original one, eg, user may
    // have changed name, title and schema for resources:
    Object.assign(dataset.descriptor, descriptor)

    const datahubConfigs = {
      apiUrl: config.get('api'),
      token: config.get('token'),
      debug: isDev ? true : false,
      ownerid: config.get('profile') ? config.get('profile').id : config.get('id'),
      owner: config.get('profile') ? config.get('profile').username : config.get('username')
    }

    const datahub = new DataHub(datahubConfigs)
    const pushResult = await datahub.push(dataset, options)
    if (!pushResult.success) {
      if (isDev) {
        console.log('Push has failed:\n' + JSON.stringify(pushResult))
      } else {
        notify({
          title: 'Some error occured while pushing your dataset',
          body: 'Please, try again later or report this error on our chat channel.',
          url: 'https://gitter.im/datahubio/chat'
        })
      }
    }

    const [ownerid, datasetName, revisionId] = pushResult.flow_id.split('/')
    returnObj.url = urljoin(config.get('domain'), datahubConfigs.owner, datasetName, 'v', revisionId)
    // Add jwt as params in the URL so when users are logged in when visiting the website:
    returnObj.url += `?jwt=${config.get('token')}&username=${config.get('profile').username}&id=${config.get('profile').id}&email=${config.get('profile').email}`
    if (!isDev) {
      notify({
        title: 'Your dataset is online!',
        body: 'Click here to visit the page!',
        url: returnObj.url
      })
    }
    return returnObj
  } catch (err) {
    showError(err)
    console.log('> [debug]\n' + err.stack)
    return returnObj
  }
}
