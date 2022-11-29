
import path from 'path'
import t from 'tap'
import dedent from 'dedent'
import { Telemetry, dirname } from '../src/index.js'
import * as helper from './helper/index.js'

// process.env.NOW = 'now'

t.test('Telemetry', async t => {
  const configFile = path.join(dirname(import.meta.url), 'fixtures/metrics.yml')
  let logger

  const now = Date.now
  t.before(() => {
    Date.now = () => 'now'
  })

  t.teardown(() => {
    Date.now = now
  })

  t.beforeEach(() => {
    logger = helper.spyLogger()
  })

  t.test('constructor', async t => {
    t.test('should create a new telemetry instance', async t => {
      const telemetry = new Telemetry({ configFile, logger })
      t.ok(telemetry)
    })

    t.test('should get error missing config file', async t => {
      t.throws(() => new Telemetry({ logger }), { message: 'Missing config yml file' })
    })

    t.test('should get error missing logger', async t => {
      t.throws(() => new Telemetry({ configFile }), { message: 'Missing logger' })
    })

    t.test('should get error on invalid config file', async t => {
      t.throws(() => new Telemetry({ configFile: '/not-a-file', logger }), { message: 'Unable to create a telemetry instance' })
      t.equal(logger.messages.error.length, 1)
      t.equal(logger.messages.error[0][1], 'error in telemetry constructor')
    })
  })

  t.test('increaseCount', async t => {
    t.test('should increase the count of a metric', async t => {
      const telemetry = new Telemetry({ configFile, logger })
      telemetry.clear()
      telemetry.createMetric('counter', 'COUNTER', 'count')

      telemetry.increaseCount('counter')

      t.equal(telemetry.export(), dedent`
      # HELP counter_count_total COUNTER (count)
      # TYPE counter_count_total counter
      counter_count_total 1 now`)
    })

    t.test('all metrics should be defined in the config file', async t => {
      const telemetry = new Telemetry({ configFile, logger })
      t.throws(() => telemetry.increaseCount('unknown'), { message: 'Metric unknown not found' })
    })
  })

  t.test('decreaseCount', async t => {
    t.test('should decrease the count of a metric', async t => {
      const telemetry = new Telemetry({ configFile, logger })
      telemetry.clear()
      telemetry.createMetric('counter', 'COUNTER', 'count')

      telemetry.decreaseCount('counter')

      t.equal(telemetry.export(), dedent`
      # HELP counter_count_total COUNTER (count)
      # TYPE counter_count_total counter
      counter_count_total -1 now`)
    })

    t.test('all metrics should be defined in the config file', async t => {
      const telemetry = new Telemetry({ configFile, logger })
      t.throws(() => telemetry.decreaseCount('unknown'), { message: 'Metric unknown not found' })
    })
  })

  t.test('trackDuration', async t => {
    t.test('should track a function', async t => {
      const telemetry = new Telemetry({ configFile, logger })
      telemetry.clear()
      telemetry.createMetric('tracking1', 'GAUGE', 'durations')

      await telemetry.trackDuration('tracking1', async () => { return 1 })

      const output = telemetry.export()
        .replace(/tracking1_durations_sum [\d.]+ now/, 'tracking1_durations_sum time now')
        .replace(/} \d+ now/mg, '} 111 now')

      t.equal(output, dedent`
      # HELP tracking1_durations GAUGE (durations)
      # TYPE tracking1_durations histogram
      tracking1_durations_count 1 now
      tracking1_durations_sum time now
      tracking1_durations_bucket{le="0.001"} 111 now
      tracking1_durations_bucket{le="0.01"} 111 now
      tracking1_durations_bucket{le="0.1"} 111 now
      tracking1_durations_bucket{le="1"} 111 now
      tracking1_durations_bucket{le="2.5"} 111 now
      tracking1_durations_bucket{le="10"} 111 now
      tracking1_durations_bucket{le="25"} 111 now
      tracking1_durations_bucket{le="50"} 111 now
      tracking1_durations_bucket{le="75"} 111 now
      tracking1_durations_bucket{le="90"} 111 now
      tracking1_durations_bucket{le="97.5"} 111 now
      tracking1_durations_bucket{le="99"} 111 now
      tracking1_durations_bucket{le="99.9"} 111 now
      tracking1_durations_bucket{le="99.99"} 111 now
      tracking1_durations_bucket{le="99.999"} 111 now`)
    })

    t.test('all metrics should be defined in the config file', async t => {
      const telemetry = new Telemetry({ configFile, logger })
      await t.rejects(() => telemetry.trackDuration('unknown'), { message: 'Metric unknown not found' })
    })

    t.test('should handle a failing function', async t => {
      const telemetry = new Telemetry({ configFile, logger })
      telemetry.clear()
      telemetry.createMetric('trackingboom', 'HISTOGRAM', 'durations')

      await telemetry.trackDuration('trackingboom', async () => { throw new Error('BOOM') })

      const output = telemetry.export()
        .replace(/trackingboom_durations_sum [\d.]+ now/, 'trackingboom_durations_sum time now')

      t.equal(output, dedent`
      # HELP trackingboom_durations HISTOGRAM (durations)
      # TYPE trackingboom_durations histogram
      trackingboom_durations_count 1 now
      trackingboom_durations_sum time now
      trackingboom_durations_bucket{le="0.001"} 0 now
      trackingboom_durations_bucket{le="0.01"} 0 now
      trackingboom_durations_bucket{le="0.1"} 0 now
      trackingboom_durations_bucket{le="1"} 0 now
      trackingboom_durations_bucket{le="2.5"} 0 now
      trackingboom_durations_bucket{le="10"} 0 now
      trackingboom_durations_bucket{le="25"} 0 now
      trackingboom_durations_bucket{le="50"} 0 now
      trackingboom_durations_bucket{le="75"} 0 now
      trackingboom_durations_bucket{le="90"} 0 now
      trackingboom_durations_bucket{le="97.5"} 0 now
      trackingboom_durations_bucket{le="99"} 0 now
      trackingboom_durations_bucket{le="99.9"} 0 now
      trackingboom_durations_bucket{le="99.99"} 0 now
      trackingboom_durations_bucket{le="99.999"} 0 now`)
    })
  })

  t.test('export', async t => {
    t.test('should get the metrics result with no registered metrics', async t => {
      const telemetry = new Telemetry({ configFile, logger })
      telemetry.clear()
      t.equal(telemetry.export(), '# no registered metrics')
    })

    t.test('should get the metrics result with registered metrics', async t => {
      const telemetry = new Telemetry({ configFile, logger })
      telemetry.clear()
      telemetry.createMetric('c1', 'COUNTER', 'durations')
      telemetry.createMetric('c2', 'GAUGE', 'count', 'gauge')
      telemetry.createMetric('c3', 'HISTOGRAM', 'durations')

      t.equal(telemetry.export(), dedent`
      # HELP c2_count GAUGE (count)
      # TYPE c2_count gauge
      c2_count 0 now`.trim()
      )
    })

    t.test('should get the metrics result with registered metrics and values', async t => {
      const telemetry = new Telemetry({ configFile, logger })
      telemetry.clear()
      telemetry.createMetric('c1', 'COUNTER', 'count')
      telemetry.createMetric('c2', 'GAUGE', 'count', 'gauge')
      telemetry.createMetric('c3', 'HISTOGRAM', 'durations')

      telemetry.increaseCount('c1', 1)
      telemetry.increaseCount('c2', 2)
      telemetry.ensureMetric('c3', 'durations').record(3)

      t.equal(telemetry.export(), dedent`
      # HELP c1_count_total COUNTER (count)
      # TYPE c1_count_total counter
      c1_count_total 1 now
      # HELP c2_count GAUGE (count)
      # TYPE c2_count gauge
      c2_count 2 now
      # HELP c3_durations HISTOGRAM (durations)
      # TYPE c3_durations histogram
      c3_durations_count 1 now
      c3_durations_sum 3 now
      c3_durations_bucket{le="0.001"} 3 now
      c3_durations_bucket{le="0.01"} 3 now
      c3_durations_bucket{le="0.1"} 3 now
      c3_durations_bucket{le="1"} 3 now
      c3_durations_bucket{le="2.5"} 3 now
      c3_durations_bucket{le="10"} 3 now
      c3_durations_bucket{le="25"} 3 now
      c3_durations_bucket{le="50"} 3 now
      c3_durations_bucket{le="75"} 3 now
      c3_durations_bucket{le="90"} 3 now
      c3_durations_bucket{le="97.5"} 3 now
      c3_durations_bucket{le="99"} 3 now
      c3_durations_bucket{le="99.9"} 3 now
      c3_durations_bucket{le="99.99"} 3 now
      c3_durations_bucket{le="99.999"} 3 now`.trim()
      )
    })
  })
})
