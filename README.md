# e-ipfs-core-lib

A library that collect utils and shared code for e-ipfs ecosystem.

## Quickstart

```
npm i e-ipfs-core-lib
```

## Api

### Telemetry
#### Telemetry

Create a telemetry manager that provide a [`prometheus`](https://github.com/prometheus) valid file [format](https://github.com/prometheus/docs/blob/main/content/docs/instrumenting/exposition_formats.md) 

Create metrics yaml configuration file:

```yaml
---
component: bitswap-peer
metrics:
  bitswap-total-connections: BitSwap Total Connections
  s3-request: AWS S3 requests
  dynamo-request: AWS DynamoDB requests
version: 0.1.0
buildDate: "20220307.1423"
```


```javascript
import path from 'path'
import { Telemetry, dirname } from 'e-ipfs-core-lib'

const configFile = path.join(dirname(import.meta.url), '../metrics.yml')
const telemetry = new Telemetry({ configFile })
telemetry.increaseCount('bitswap-total-connections', 2)

const result = await telemetry.export()
console.log(result)
telemetry.resetCount()
```

#### Telemetry instance methods
* export: Export the metrics in `prometheus` format
  ```
    # HELP counter_grouped_count_total COUNTER (grouped-count)
    # TYPE counter_grouped_count_total counter
    counter_grouped_count_total{id="123"} 1 now
    counter_grouped_count_total{id="456"} 2 now
    ```
* resetAll(): Reset all metrics
* resetCounters(): Reset count and groupedCount metrics
* async export(): Export file in Prometheus format 
* increaseCount(category, amount = 1): Increase the count for a category
  * category: String - The given name of the category
* increaseGroupedCount(category, labels: Array, amount = 1): Increase the count for a key in a category
  * category: String - The given name of the category
  * labels: Array<String> - The labels of the metric (eg. ['GET', 404])
  * amount: Number (Default 1) - The amount to add to the metric
* increaseGauge(category, amount = 1): Increase the gauge for a category
  * category: String - The given name of the category
  * amount: Number (Default 1) - The amount to add to the metric
* decreaseGauge(category, amount = 1): Increase the gauge for a category
  * category: String - The given name of the category
  * amount: Number (Default 1) - The amount to add to the metric
* setGauge(category, value): Set the gauge for a category
  * category: String - The given name of the category
  * value: Number - The value to set the metric
* trackDuration(category, promise): Track the duration of an async call
  * category: String - The given name of the category
  * promise: Promise - The function to be tracked

### Utils
#### dirname
#### version
#### cidToKey

### AWS-Client
#### createAwsClient,
#### awsClientOptions,
#### Client

### Logger
#### createLogger

### Protocol

