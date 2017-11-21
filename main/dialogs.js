// Packages
const { dialog } = require('electron')
const sudo = require('sudo-prompt')


exports.runAsRoot = (command, why) => {
  const answer = dialog.showMessageBox({
    type: 'question',
    message: 'Now Needs More Permissions',
    detail: why,
    buttons: ['OK', 'Please, no!']
  })

  if (answer === 1) {
    throw new Error('No permissions given')
  }

  return new Promise((resolve, reject) => {
    const options = {
      name: 'Data'
    }

    sudo.exec(command, options, async error => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

exports.error = (detail, trace, win) => {
  // We need to log the error in order to be able to inspect it
  if (trace) {
    console.error(trace)
  }

  dialog.showMessageBox(win || null, {
    type: 'error',
    message: 'An Error Occurred',
    detail,
    buttons: []
  })
}
