// Native
const path = require('path')

const {Dataset, File} = require('data.js')
const hri = require('human-readable-ids').hri


module.exports = async (filePath) => {
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
