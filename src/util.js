
import fs from 'fs'
import path from 'path'
import url from 'url'
import { base58btc as base58 } from 'multiformats/bases/base58'

function dirname (importMetaUrl) {
  return path.dirname(url.fileURLToPath(importMetaUrl))
}

function version (packageJsonFile) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'))
  return packageJson.version
}

function cidToKey (cid) {
  try {
    return base58.encode(cid.multihash.bytes)
  } catch (error) {
    return false
  }
}

export { dirname, version, cidToKey }
