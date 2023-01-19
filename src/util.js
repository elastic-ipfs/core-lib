
import fs from 'fs'
import path from 'path'
import url from 'url'
import * as varint from 'varint'
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

/**
 * from https://github.com/ipfs/js-ipfs-bitswap
 * @param {Array<number>} buf
 * @returns {Uint8Array}
 */
function varintEncoder (buf) {
  let out = new Uint8Array(buf.reduce((acc, curr) => {
    return acc + varint.default.encodingLength(curr)
  }, 0))

  let offset = 0

  for (const num of buf) {
    out = varint.encode(num, out, offset)

    // @ts-expect-error types are wrong
    offset += varint.default.encodingLength(num)
  }

  return out
}

export { dirname, version, cidToKey, varintEncoder }
