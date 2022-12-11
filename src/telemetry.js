import { readFileSync } from 'fs'
import { load as ymlLoad } from 'js-yaml'
import promClient from 'prom-client'
const PERCENTILES = [0.001, 0.01, 0.1, 1, 2.5, 10, 25, 50, 75, 90, 97.5, 99, 99.9, 99.99, 99.999]

class Telemetry {
  constructor ({ configFile, logger }) {
    if (!configFile) {
      throw new Error('Missing config yml file')
    }
    if (!logger) {
      throw new Error('Missing logger')
    }

    this.allRegistry = new promClient.Registry()
    this.countRegistry = new promClient.Registry()
    this.labelCountRegistry = new promClient.Registry()
    this.durationsRegistry = new promClient.Registry()
    this.gaugeRegistry = new promClient.Registry()
    this.logger = logger

    try {
      const { component, metrics, version, buildDate } = ymlLoad(readFileSync(configFile, 'utf-8'))

      // Setup
      this.component = component
      this.version = `${version}-build.${buildDate}`

      // Create metrics
      for (const [category, metric] of Object.entries(metrics.count || {})) {
      /* eslint-disable-next-line no-new */
        new promClient.Counter({
          name: category.replaceAll('-', '_'),
          help: metric.description,
          registers: [this.countRegistry, this.allRegistry] // specify a non-default registry
        })
      }
      for (const [category, metric] of Object.entries(metrics.labelCount || {})) {
        /* eslint-disable-next-line no-new */
        new promClient.Counter({
          name: category.replaceAll('-', '_'),
          help: metric.description,
          labelNames: metric.labels,
          registers: [this.labelCountRegistry, this.allRegistry] // specify a non-default registry
        })
      }
      for (const [category, metric] of Object.entries(metrics.durations || {})) {
        /* eslint-disable-next-line no-new */
        new promClient.Histogram({
          name: category.replaceAll('-', '_'),
          help: metric.description,
          buckets: PERCENTILES,
          registers: [this.durationsRegistry, this.allRegistry] // specify a non-default registry
        })
      }
      for (const [category, metric] of Object.entries(metrics.gauge || {})) {
        /* eslint-disable-next-line no-new */
        new promClient.Gauge({
          name: category.replaceAll('-', '_'),
          help: metric.description,
          registers: [this.gaugeRegistry, this.allRegistry] // specify a non-default registry
        })
      }
    } catch (err) {
      logger.error({ err }, 'error in telemetry constructor')
      throw new Error('Unable to create a telemetry instance')
    }
  }

  resetAll () {
    this.allRegistry.resetMetrics()
  }

  resetCounters () {
    this.countRegistry.resetMetrics()
    this.labelCountRegistry.resetMetrics()
  }

  async export () {
    return this.allRegistry.metrics()
  }

  increaseCount (category, amount = 1) {
    const metric = this.countRegistry.getSingleMetric(category.replaceAll('-', '_'))
    if (!metric) throw new Error(`Metric ${category} not found`)
    return metric.inc(amount)
  }

  increaseLabelCount (category, labels = [], amount = 1) {
    const metric = this.labelCountRegistry.getSingleMetric(category.replaceAll('-', '_'))
    if (!metric) throw new Error(`Metric ${category} not found`)
    return metric.labels(...labels).inc(amount)
  }

  increaseGauge (category, amount = 1) {
    const metric = this.gaugeRegistry.getSingleMetric(category.replaceAll('-', '_'))
    if (!metric) throw new Error(`Metric ${category} not found`)
    return metric.inc(amount)
  }

  decreaseGauge (category, amount = 1) {
    const metric = this.gaugeRegistry.getSingleMetric(category.replaceAll('-', '_'))
    if (!metric) throw new Error(`Metric ${category} not found`)
    return metric.inc(-1 * amount)
  }

  setGauge (category, value) {
    const metric = this.gaugeRegistry.getSingleMetric(category.replaceAll('-', '_'))
    if (!metric) throw new Error(`Metric ${category} not found`)
    return metric.set(value)
  }

  async trackDuration (category, promise) {
    const metric = this.durationsRegistry.getSingleMetric(category.replaceAll('-', '_'))
    if (!metric) throw new Error(`Metric ${category} not found`)

    const end = metric.startTimer()

    try {
      return await promise
    } finally {
      end()
    }
  }
}

export { Telemetry }
