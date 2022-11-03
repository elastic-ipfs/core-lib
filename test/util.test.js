
import path from 'path'
import t from 'tap'
import { CID } from 'multiformats/cid'
import { dirname, version, cidToKey } from '../src/util.js'

t.test('dirname', async t => {
  t.test('get the dirname', async t => {
    const dir = dirname(import.meta.url)

    t.match(dir, '/test')
  })
})

t.test('version', async t => {
  t.test('get the version from package.json file', async t => {
    const v = version(path.join(dirname(import.meta.url), '../package.json'))

    t.match(v, /\d+.\d+.\d+/)
  })
})

t.test('cidToKey', async t => {
  t.test('convert cid to key', async t => {
    const cid = CID.parse('bafybeiccfclkdtucu6y4yc5cpr6y3yuinr67svmii46v5cfcrkp47ihehy')
    const key = cidToKey(cid)

    t.equal(key, 'zQmSnuWmxptJZdLJpKRarxBMS2Ju2oANVrgbr2xWbie9b2D')
  })

  t.test('convert a non-cid to key', async t => {
    const key = cidToKey(null)

    t.equal(key, false)
  })
})
