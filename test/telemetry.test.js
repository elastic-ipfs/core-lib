import path from 'path'
import { promisify } from 'util'
import t from 'tap'
import dedent from 'dedent'
import {
  Telemetry,
  dirname
} from '../src/index.js'
import * as helper from './helper/index.js'

const setTimeoutAsync = promisify(setTimeout)

t.test('Telemetry', async t => {
  const defaultConfigFile = path.join(dirname(import.meta.url), 'fixtures/metrics.yml')
  const noMetricConfigFile = path.join(dirname(import.meta.url), 'fixtures/no-metrics.yml')
  const noCountMetricConfigFile = path.join(dirname(import.meta.url), 'fixtures/no-count-metrics.yml')
  const processMetricConfigFile = path.join(dirname(import.meta.url), 'fixtures/process-metrics.yml')
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
      const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })
      t.ok(telemetry)

      t.equal(telemetry.allRegistry.getSingleMetric('s3_request_count').constructor.name, 'Counter')
      t.equal(telemetry.countRegistry.getSingleMetric('s3_request_count').constructor.name, 'Counter')
      t.equal(telemetry.allRegistry.getSingleMetric('dynamo_request_count').constructor.name, 'Counter')
      t.equal(telemetry.countRegistry.getSingleMetric('dynamo_request_count').constructor.name, 'Counter')
      t.equal(telemetry.allRegistry.getSingleMetric('bitswap_request_per_connections_label_count').constructor.name, 'Counter')
      t.equal(telemetry.labelCountRegistry.getSingleMetric('bitswap_request_per_connections_label_count').constructor.name, 'Counter')
      t.equal(telemetry.allRegistry.getSingleMetric('bitswap_connections_duration_durations').constructor.name, 'Histogram')
      t.equal(telemetry.durationsRegistry.getSingleMetric('bitswap_connections_duration_durations').constructor.name, 'Histogram')
      t.equal(telemetry.allRegistry.getSingleMetric('bitswap_event_loop_utilization').constructor.name, 'Gauge')
      t.equal(telemetry.gaugeRegistry.getSingleMetric('bitswap_event_loop_utilization').constructor.name, 'Gauge')
      t.equal(telemetry.allRegistry.getSingleMetric('bitswap_total_connections').constructor.name, 'Gauge')
      t.equal(telemetry.gaugeRegistry.getSingleMetric('bitswap_total_connections').constructor.name, 'Gauge')
    })

    t.test('should get error missing config file', async t => {
      t.throws(() => new Telemetry({ logger }), { message: 'Missing config yml file' })
    })

    t.test('should get error missing logger', async t => {
      t.throws(() => new Telemetry({ configFile: defaultConfigFile }), { message: 'Missing logger' })
    })

    t.test('should get error on invalid config file', async t => {
      t.throws(() => new Telemetry({
        configFile: '/not-a-file',
        logger
      }), { message: 'Unable to create a telemetry instance' })
      t.equal(logger.messages.error.length, 1)
      t.equal(logger.messages.error[0][1], 'error in telemetry constructor')
    })
  })

  t.test('increaseCount', async t => {
    t.test('should increase the count of a metric', async t => {
      const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })
      telemetry.increaseCount('s3-request-count')
      telemetry.increaseCount('s3-request-count', 10)

      t.equal((await telemetry.countRegistry.metrics()).trim(), dedent`
      # HELP s3_request_count AWS S3 requests
      # TYPE s3_request_count counter
      s3_request_count 11
      
      # HELP dynamo_request_count AWS DynamoDB requests
      # TYPE dynamo_request_count counter
      dynamo_request_count 0
      `.trim())

      t.equal((await telemetry.countRegistry.metrics()).trim(), dedent`
      # HELP s3_request_count AWS S3 requests
      # TYPE s3_request_count counter
      s3_request_count 11
      
      # HELP dynamo_request_count AWS DynamoDB requests
      # TYPE dynamo_request_count counter
      dynamo_request_count 0
      `.trim())

      telemetry.resetCounters()

      t.equal((await telemetry.countRegistry.metrics()).trim(), dedent`
      # HELP s3_request_count AWS S3 requests
      # TYPE s3_request_count counter
      s3_request_count 0
      
      # HELP dynamo_request_count AWS DynamoDB requests
      # TYPE dynamo_request_count counter
      dynamo_request_count 0
      `.trim())
    })

    t.test('all metrics should be defined in the config file', async t => {
      const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })
      t.throws(() => telemetry.increaseCount('unknown'), { message: 'Metric unknown not found' })
    })
  })

  t.test('increaseLabelCount', async t => {
    t.test('should increase the count of a metric', async t => {
      const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })
      telemetry.increaseLabelCount('bitswap-request-per-connections-label-count', ['GET', '200'])
      telemetry.increaseLabelCount('bitswap-request-per-connections-label-count', ['GET', '200'], 5)
      telemetry.increaseLabelCount('bitswap-request-per-connections-label-count', ['POST', '200'], 8)
      telemetry.increaseLabelCount('bitswap-request-per-connections-label-count', ['POST', '400'], 10)

      t.equal((await telemetry.labelCountRegistry.metrics()).trim(), dedent`
      # HELP bitswap_request_per_connections_label_count BitSwap Request Per Connnection
      # TYPE bitswap_request_per_connections_label_count counter
      bitswap_request_per_connections_label_count{method="GET",status="200"} 6
      bitswap_request_per_connections_label_count{method="POST",status="200"} 8
      bitswap_request_per_connections_label_count{method="POST",status="400"} 10
      `.trim())

      t.equal((await telemetry.labelCountRegistry.metrics()).trim(), dedent`
      # HELP bitswap_request_per_connections_label_count BitSwap Request Per Connnection
      # TYPE bitswap_request_per_connections_label_count counter
      bitswap_request_per_connections_label_count{method="GET",status="200"} 6
      bitswap_request_per_connections_label_count{method="POST",status="200"} 8
      bitswap_request_per_connections_label_count{method="POST",status="400"} 10
      `.trim())

      telemetry.resetCounters()

      t.equal((await telemetry.labelCountRegistry.metrics()).trim(), dedent`
      # HELP bitswap_request_per_connections_label_count BitSwap Request Per Connnection
      # TYPE bitswap_request_per_connections_label_count counter
      `.trim())
    })

    t.test('all metrics should be defined in the config file', async t => {
      const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })
      t.throws(() => telemetry.increaseLabelCount('unknown'), { message: 'Metric unknown not found' })
    })
  })

  t.test('update gauge values', async t => {
    t.test('should increase the gouge of a metric', async t => {
      const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })
      telemetry.increaseGauge('bitswap-total-connections')
      telemetry.increaseGauge('bitswap-total-connections', 10)

      t.equal((await telemetry.gaugeRegistry.metrics()).trim(), dedent`
      # HELP bitswap_event_loop_utilization BitSwap Event Loop Utilization
      # TYPE bitswap_event_loop_utilization gauge
      bitswap_event_loop_utilization 0
      
      # HELP bitswap_total_connections BitSwap Total Connections
      # TYPE bitswap_total_connections gauge
      bitswap_total_connections 11
      `.trim())
      telemetry.decreaseGauge('bitswap-total-connections', 5)

      t.equal((await telemetry.gaugeRegistry.metrics()).trim(), dedent`
      # HELP bitswap_event_loop_utilization BitSwap Event Loop Utilization
      # TYPE bitswap_event_loop_utilization gauge
      bitswap_event_loop_utilization 0
      
      # HELP bitswap_total_connections BitSwap Total Connections
      # TYPE bitswap_total_connections gauge
      bitswap_total_connections 6
      `.trim())

      telemetry.setGauge('bitswap-total-connections', 21)

      t.equal((await telemetry.gaugeRegistry.metrics()).trim(), dedent`
      # HELP bitswap_event_loop_utilization BitSwap Event Loop Utilization
      # TYPE bitswap_event_loop_utilization gauge
      bitswap_event_loop_utilization 0

      # HELP bitswap_total_connections BitSwap Total Connections
      # TYPE bitswap_total_connections gauge
      bitswap_total_connections 21
      `.trim())

      telemetry.resetAll()

      t.equal((await telemetry.gaugeRegistry.metrics()).trim(), dedent`
      # HELP bitswap_event_loop_utilization BitSwap Event Loop Utilization
      # TYPE bitswap_event_loop_utilization gauge
      bitswap_event_loop_utilization 0
      
      # HELP bitswap_total_connections BitSwap Total Connections
      # TYPE bitswap_total_connections gauge
      bitswap_total_connections 0
      `.trim())
    })

    t.test('should reset only the gauge', async t => {
      const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })
      telemetry.increaseGauge('bitswap-total-connections')
      telemetry.increaseGauge('bitswap-total-connections', 10)

      telemetry.resetGauges()

      t.equal((await telemetry.gaugeRegistry.metrics()).trim(), dedent`
      # HELP bitswap_event_loop_utilization BitSwap Event Loop Utilization
      # TYPE bitswap_event_loop_utilization gauge
      bitswap_event_loop_utilization 0
      
      # HELP bitswap_total_connections BitSwap Total Connections
      # TYPE bitswap_total_connections gauge
      bitswap_total_connections 0
      `.trim())
    })

    t.test('all metrics should be defined in the config file', async t => {
      const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })
      t.throws(() => telemetry.increaseGauge('unknown'), { message: 'Metric unknown not found' })
      t.throws(() => telemetry.decreaseGauge('unknown'), { message: 'Metric unknown not found' })
      t.throws(() => telemetry.setGauge('unknown'), { message: 'Metric unknown not found' })
    })
  })

  t.test('trackDuration', async t => {
    t.test('should track a function', async t => {
      const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })

      await Promise.all([
        await telemetry.trackDuration('bitswap-connections-duration-durations', async () => { await setTimeoutAsync(100) }),
        await telemetry.trackDuration('bitswap-connections-duration-durations', async () => { await setTimeoutAsync(200) }),
        await telemetry.trackDuration('bitswap-connections-duration-durations', async () => { await setTimeoutAsync(300) })
      ])
      t.ok((await telemetry.durationsRegistry.metrics()).includes('bitswap_connections_duration_durations_count 3'))
      await Promise.all([
        await telemetry.trackDuration('bitswap-connections-duration-durations', async () => { await setTimeoutAsync(100) }),
        await telemetry.trackDuration('bitswap-connections-duration-durations', async () => { await setTimeoutAsync(200) }),
        await telemetry.trackDuration('bitswap-connections-duration-durations', async () => { await setTimeoutAsync(300) })
      ])
      t.ok((await telemetry.durationsRegistry.metrics()).includes('bitswap_connections_duration_durations_count 6'))
      telemetry.resetDurations()
      t.ok(!(await telemetry.durationsRegistry.metrics()).includes('bitswap_connections_duration_durations_count'))
    })

    t.test('all metrics should be defined in the config file', async t => {
      const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })
      await t.rejects(() => telemetry.trackDuration('unknown'), { message: 'Metric unknown not found' })
    })

    t.test('should handle a failing function', async t => {
      const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })
      await telemetry.trackDuration('bitswap-connections-duration-durations', async () => { throw new Error('BOOM') })

      t.ok((await telemetry.durationsRegistry.metrics()).includes('bitswap_connections_duration_durations_count 1'))
    })
  })

  t.test('export values', async t => {
    t.test('should export all values', async t => {
      const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })
      telemetry.increaseGauge('bitswap-total-connections')
      telemetry.increaseGauge('bitswap-total-connections', 10)
      await telemetry.trackDuration('bitswap-connections-duration-durations', async () => { throw new Error('BOOM') })
      telemetry.increaseCount('s3-request-count', 10)
      telemetry.increaseLabelCount('bitswap-request-per-connections-label-count', ['GET', '200'])

      const result = await telemetry.export()

      t.ok(result.includes('s3_request_count 10'))
      t.ok(result.includes('dynamo_request_count 0'))
      t.ok(result.includes('bitswap_request_per_connections_label_count{method="GET",status="200"} 1'))
      t.ok(result.includes('bitswap_connections_duration_durations_count 1'))
      t.ok(result.includes('bitswap_event_loop_utilization 0'))
      t.ok(result.includes('bitswap_total_connections 11'))
    })
  })

  t.test('should create a new telemetry with no metrics', async t => {
    const telemetry = new Telemetry({ configFile: noMetricConfigFile, logger })

    t.same(Object.keys(telemetry.allRegistry._metrics), ['s3_request_count',
      'dynamo_request_count'])
  })

  t.test('should create a new telemetry with no metrics', async t => {
    const telemetry = new Telemetry({ configFile: noCountMetricConfigFile, logger })

    t.same(Object.keys(telemetry.allRegistry._metrics), ['bitswap_connections_duration_durations'])
  })

  t.test('should collect event loop metric when set from config file', async t => {
    const telemetry = new Telemetry({ configFile: processMetricConfigFile, logger })

    const result = await telemetry.export()

    await setTimeoutAsync(500)

    t.ok(result.includes('bitswap_elu'))
    t.ok(telemetry.collectEluInterval)
  })

  t.test('should get a gauge metric value', async t => {
    const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })

    telemetry.increaseGauge('bitswap-total-connections', 99)

    t.equal(telemetry.getGaugeValue('bitswap-total-connections'), 99)
  })

  t.test('should get a histogram metric value', async t => {
    const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })

    telemetry.trackDuration('bitswap-connections-duration-durations', async () => { await setTimeoutAsync(100) })

    await setTimeoutAsync(100)

    t.ok(telemetry.getHistogramValue('bitswap-connections-duration-durations') > 0)
  })

  t.test('should not get a gauge metric value', async t => {
    const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })
    t.equal(telemetry.getGaugeValue('not-a-metric-name'), undefined)
  })

  t.test('should get a histogram metric value', async t => {
    const telemetry = new Telemetry({ configFile: defaultConfigFile, logger })
    t.equal(telemetry.getHistogramValue('not-a-metric-name'), undefined)
  })
})
