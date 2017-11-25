const {config} = require('datahub-client')
const {login, authenticate} = require('datahub-client')

const { error: showError } = require('../dialogs')


module.exports = async () => {
  const apiUrl = config.get('api') || 'https://api.datahub.io'
  const token = config.get('token')

  let out
  try {
    out = await authenticate(apiUrl, token)
  } catch (err) {
    showError(err)
    return {success: false}
  }

  if (out.authenticated) {
    showError('You are already logged in.')
    return {success: true}
  }

  const authUrl = out.providers.github.url
  try {
    await login(apiUrl, authUrl)
    return {success: true}
  } catch (err) {
    showError(err)
    return {success: false}
  }
}
