
import t from 'tap'
// eslint-disable-next-line import/no-named-default
import { default as split } from 'split2'
import { createLogger } from '../src/logger.js'

function once (emitter, name) {
  return new Promise((resolve, reject) => {
    if (name !== 'error') emitter.once('error', reject)
    emitter.once(name, (...args) => {
      emitter.removeListener('error', reject)
      resolve(...args)
    })
  })
}

function sink () {
  const result = split((data) => {
    try {
      return JSON.parse(data)
    } catch (err) {
      console.error(err)
    }
  })
  return result
}

t.test('createLogger', async t => {
  t.test('create a logger', async t => {
    const logger = createLogger({ version: '1.2.3', pretty: true, level: 'warn' })
    t.equal(logger.constructor.name, 'Pino')
  })

  t.test('create a logger with default settings', async t => {
    const stream = sink()
    const logger = createLogger({}, stream)

    t.equal(logger.level, 'info')

    logger.info({ a: 1 }, 'hi')
    const result = await once(stream, 'data')

    t.equal(result.level, 30)
    t.equal(result.msg, 'hi')
    t.equal(result.v, undefined)
  })

  t.test('log an error properly', async t => {
    const stream = sink()
    const logger = createLogger({ version: '1.2.3' }, stream)

    t.equal(logger.level, 'info')

    const err = new Error('FAILED')
    logger.error({ err }, 'error here')
    const result = await once(stream, 'data')

    t.equal(result.level, 50)
    t.equal(result.msg, 'error here')
    t.equal(result.v, '1.2.3')

    const errString = result.err.split('\n')
    t.match(errString[0], '[Error] FAILED')
    t.match(errString[1], 'Error: FAILED')
    t.match(errString[2], /test\/logger.test.js/)
  })

  t.test('log an error with code properly', async t => {
    const stream = sink()
    const logger = createLogger({ version: '1.2.3' }, stream)

    t.equal(logger.level, 'info')

    const err = new Error('FAILED')
    err.code = 'CODE'

    logger.error({ err }, 'error here')
    const result = await once(stream, 'data')

    t.equal(result.level, 50)
    t.equal(result.msg, 'error here')
    t.equal(result.v, '1.2.3')

    const errString = result.err.split('\n')
    t.match(errString[0], '[CODE] FAILED')
    t.match(errString[1], 'Error: FAILED')
    t.match(errString[2], /test\/logger.test.js/)
  })
})
