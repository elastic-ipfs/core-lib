
import { readFileSync } from 'fs'
import { load as ymlLoad } from 'js-yaml'
import { build as buildHistogram } from 'hdr-histogram-js'

const PERCENTILES = [0.001, 0.01, 0.1, 1, 2.5, 10, 25, 50, 75, 90, 97.5, 99, 99.9, 99.99, 99.999]

class Aggregator {
  constructor (category, description, metric) {
    this.tag = `${category}-${metric}`
    this.description = `${description} (${metric})`
    this.exportName = this.tag.replaceAll('-', '_')

    if (category.match(/active|pending/)) {
      this.type = 'gauge'
    } else if (metric === 'durations') {
      this.type = 'histogram'
    } else {
      this.type = 'counter'
      this.exportName += '_total'
    }

    this.sum = 0
    this.histogram = buildHistogram({
      lowestDiscernibleValue: 1,
      highestTrackableValue: 1e9,
      numberOfSignificantValueDigits: 5
    })
  }

  record (value) {
    this.sum += value

    if (this.type === 'histogram') {
      this.histogram.recordValue(value)
    }
  }

  reset () {
    this.sum = 0
    this.histogram.reset()
  }

  current () {
    const { minNonZeroValue: min, maxValue: max, mean, stdDeviation: stdDev, totalCount: count } = this.histogram

    const value = {
      empty: (this.type === 'histogram' && count === 0) || (this.type === 'counter' && this.sum === 0),
      sum: this.sum,
      histogram:
        count > 0
          ? {
              count,
              min,
              max,
              mean,
              stdDev,
              stdError: stdDev / Math.sqrt(count),
              percentiles: Object.fromEntries(
                PERCENTILES.map(percentile => [percentile, this.histogram.getValueAtPercentile(percentile)])
              )
            }
          : undefined,
      timestamp: Date.now()
    }

    this.reset()

    return value
  }
}

class Telemetry {
  constructor ({ configFile, logger }) {
    if (!configFile) {
      throw new Error('Missing config yml file')
    }
    if (!logger) {
      throw new Error('Missing logger')
    }

    this.logger = logger

    try {
      const { component, metrics, version, buildDate } = ymlLoad(readFileSync(configFile, 'utf-8'))
      // Setup
      this.component = component
      this.version = `${version}-build.${buildDate}`

      // Create metrics
      this.metrics = new Map()
      for (const [category, description] of Object.entries(metrics)) {
        this.createMetric(category, description, 'count')
        this.createMetric(category, description, 'durations')
      }
    } catch (err) {
      logger.error({ err }, 'error in telemetry constructor')
      throw new Error('Unable to create a telemetry instance')
    }
  }

  clear () {
    this.metrics.clear()
  }

  createMetric (category, description, metric) {
    const instance = new Aggregator(category, description, metric)

    this.metrics.set(instance.tag, instance)
  }

  ensureMetric (category, metric) {
    const metricObject = this.metrics.get(`${category}-${metric}`)

    if (!metricObject) {
      throw new Error(`Metric ${category} not found`)
    }

    return metricObject
  }

  export () {
    let output = ''

    for (const metric of this.metrics.values()) {
      const current = metric.current()

      if (current.empty) {
        continue
      }

      output += `# HELP ${metric.exportName} ${metric.description}\n`
      output += `# TYPE ${metric.exportName} ${metric.type}\n`

      if (metric.type === 'histogram') {
        output += `${metric.exportName}_count ${current.histogram.count} ${current.timestamp}\n`
        output += `${metric.exportName}_sum ${current.sum} ${current.timestamp}\n`

        const percentilesValues = current.histogram.percentiles
        for (const percentile of PERCENTILES) {
          output += `${metric.exportName}_bucket{le="${percentile}"} ${percentilesValues[percentile]} ${current.timestamp}\n`
        }
      } else {
        output += `${metric.exportName} ${current.sum} ${current.timestamp}\n`
      }
    }

    if (!output) {
      output = '# no registered metrics'
    }

    return output.trim()
  }

  increaseCount (category, amount = 1) {
    const metric = this.ensureMetric(category, 'count')
    metric.record(amount)
  }

  decreaseCount (category, amount = 1) {
    const metric = this.ensureMetric(category, 'count')
    metric.record(-1 * amount)
  }

  async trackDuration (category, promise) {
    const metric = this.ensureMetric(category, 'durations')
    const startTime = process.hrtime.bigint()

    try {
      return await promise
    } finally {
      metric.record(Number(process.hrtime.bigint() - startTime) / 1e6)
    }
  }
}

export { Telemetry }
