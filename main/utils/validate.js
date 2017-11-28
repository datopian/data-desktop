const {validate} = require('datahub-client')

// Handling all uncaughtException here as thrown errors from tableschema.read
// behaves in a weird way (throws several errors I suppose) so I cannot catch it
process.on('uncaughtException', (err) => {
  console.error('>>> !Erorr: ' + err)
})

module.exports = async (resources) => {
  resources = JSON.parse(resources)
  await Promise.all(resources.map(async resource => {
    try {
      await validate.validateData(resource.schema, resource.data)
    } catch (err) {
      for (const error of err.errors) {
        // Store error message in field descriptor's "error" property:
        resource.schema.fields[error.columnNumber-1].error = error.message
        // If rowNumber is available add it into error message:
        if (error.rowNumber) {
          resource.schema.fields[error.columnNumber-1].error += ` (row: ${error.rowNumber})`
        }
      }
    }
  }))
  return resources
}
