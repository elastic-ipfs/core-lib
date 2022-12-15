
import { performance } from 'node:perf_hooks'
import { readFileSync } from 'fs'
import { load as ymlLoad } from 'js-yaml'
import promClient from 'prom-client'
const PERCENTILES = [0.1, 1, 10, 25, 50, 75, 90, 97.5, 99]

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
      this.metrics = new Map()

      // Create metrics
      for (const [category, metric] of Object.entries(metrics.count || {})) {
        this.metrics.set(category, new promClient.Counter({
          name: category.replaceAll('-', '_'),
          help: metric.description,
          registers: [this.countRegistry, this.allRegistry] // specify a non-default registry
        }))
      }
      for (const [category, metric] of Object.entries(metrics.labelCount || {})) {
        this.metrics.set(category, new promClient.Counter({
          name: category.replaceAll('-', '_'),
          help: metric.description,
          labelNames: metric.labels,
          registers: [this.labelCountRegistry, this.allRegistry] // specify a non-default registry
        }))
      }
      for (const [category, metric] of Object.entries(metrics.durations || {})) {
        this.metrics.set(category, new promClient.Histogram({
          name: category.replaceAll('-', '_'),
          help: metric.description,
          buckets: PERCENTILES,
          registers: [this.durationsRegistry, this.allRegistry] // specify a non-default registry
        }))
      }
      for (const [category, metric] of Object.entries(metrics.gauge || {})) {
        this.metrics.set(category, new promClient.Gauge({
          name: category.replaceAll('-', '_'),
          help: metric.description,
          registers: [this.gaugeRegistry, this.allRegistry] // specify a non-default registry
        }))
      }

      if (metrics.process?.elu) {
        this.collectEventLoopUtilization({
          name: metrics.process.elu.name,
          description: metrics.process.elu.description,
          interval: metrics.process.elu.interval,
          registers: [this.allRegistry]
        })
      }
    } catch (err) {
      logger.error({ err }, 'error in telemetry constructor')
      throw new Error('Unable to create a telemetry instance')
    }
  }

  collectEventLoopUtilization ({ name, description, interval, registers }) {
    const metric = new promClient.Gauge({
      name: name.replaceAll('-', '_'),
      help: description,
      registers
    })
    this.metrics.set(name, metric)

    let elu1 = performance.eventLoopUtilization()
    this.collectEluInterval = setInterval(() => {
      const elu2 = performance.eventLoopUtilization()
      const u = performance.eventLoopUtilization(elu2, elu1)
      metric.set(u.utilization)
      elu1 = elu2
    }, interval).unref()
  }

  resetAll () {
    this.allRegistry.resetMetrics()
  }

  resetCounters () {
    this.countRegistry.resetMetrics()
    this.labelCountRegistry.resetMetrics()
  }

  resetDurations () {
    this.durationsRegistry.resetMetrics()
  }

  resetGauges () {
    this.gaugeRegistry.resetMetrics()
  }

  async export () {
    return this.allRegistry.metrics()
  }

  get (name) {
    return this.metrics.get(name)
  }

  getGaugeValue (name) {
    const value = this.get(name)
    if (!value) { return }
    return value.hashMap[''].value
  }

  getHistogramValue (name) {
    const value = this.get(name)
    if (!value) { return }
    return value.hashMap && value.hashMap['']?.sum
  }

  increaseCount (category, amount = 1) {
    const metric = this.metrics.get(category)
    if (!metric) throw new Error(`Metric ${category} not found`)
    return metric.inc(amount)
  }

  increaseLabelCount (category, labels = [], amount = 1) {
    const metric = this.metrics.get(category)
    if (!metric) throw new Error(`Metric ${category} not found`)
    return metric.labels(...labels).inc(amount)
  }

  increaseGauge (category, amount = 1) {
    const metric = this.metrics.get(category)
    if (!metric) throw new Error(`Metric ${category} not found`)
    return metric.inc(amount)
  }

  decreaseGauge (category, amount = 1) {
    const metric = this.metrics.get(category)
    if (!metric) throw new Error(`Metric ${category} not found`)
    return metric.inc(-1 * amount)
  }

  setGauge (category, value) {
    const metric = this.metrics.get(category)
    if (!metric) throw new Error(`Metric ${category} not found`)
    return metric.set(value)
  }

  async trackDuration (category, promise) {
    const metric = this.metrics.get(category)
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
