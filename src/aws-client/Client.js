
import path from 'path'
import fs from 'fs'
import { setTimeout as sleep } from 'timers/promises'
import { Piscina } from 'piscina'
import { Agent, request } from 'undici'
import { xml2js } from 'xml-js'
import { BufferList } from 'bl'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { dirname } from '../util.js'

const signerWorker = new Piscina({
  filename: path.resolve(dirname(import.meta.url), './signer-worker.cjs'),
  idleTimeout: Math.pow(2, 31) - 1
})

/**
 * s3 requests are multi region
 * dynamo requests point to a single region, defined in `dynamoOptions.region`
 * @see https://docs.aws.amazon.com/index.html
 */
class Client {
  constructor ({ agent, awsAgentOptions, s3Options, dynamoOptions, refreshCredentialsInterval, credentialDurationSeconds, roleArn = process.env.AWS_ROLE_ARN, identityToken, roleSessionName, logger }) {
    // TODO validate params

    if (!dynamoOptions?.region) {
      throw new Error('missing dynamo region')
    }

    // custom agent is set for testing purpose only
    this.agent = agent ?? new Agent(this.awsAgentOptions)
    this.awsAgentOptions = awsAgentOptions
    this.s3Options = s3Options
    this.dynamoOptions = dynamoOptions
    this.dynamoUrl = `https://dynamodb.${dynamoOptions.region}.amazonaws.com`

    this.credentialDurationSeconds = credentialDurationSeconds // in seconds
    this.refreshCredentialsInterval = refreshCredentialsInterval
    this.credentialRefreshTimer = null
    this.roleArn = roleArn
    this.identityToken = identityToken
    this.roleSessionName = roleSessionName

    if (!this.identityToken && process.env.AWS_WEB_IDENTITY_TOKEN_FILE) {
      this.identityTokenFile = path.resolve(process.cwd(), process.env.AWS_WEB_IDENTITY_TOKEN_FILE)
    }

    this.logger = logger

    this.credentials = {
      keyId: '',
      accessKey: '',
      sessionToken: ''
    }
  }

  async init () {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.credentials.keyId = process.env.AWS_ACCESS_KEY_ID
      this.credentials.accessKey = process.env.AWS_SECRET_ACCESS_KEY

      return
    }

    if (this.identityTokenFile) {
      this.identityToken = fs.readFileSync(this.identityTokenFile, 'utf8')
    }

    if (!this.refreshCredentialsInterval) {
      return
    }

    const credentials = await this.refreshCredentials()

    // Every N minutes we rotate the keys using STS
    this.credentialRefreshTimer = setInterval(async () => {
      try {
        if (this.identityTokenFile) {
          this.identityToken = fs.readFileSync(this.identityTokenFile, 'utf8')
        }
        await this.refreshCredentials()
      } catch (err) {
        this.logger.fatal({ err }, 'AwsClient.refreshCredentials failed')
      }
    }, this.refreshCredentialsInterval).unref()

    return credentials
  }

  close () {
    this.credentialRefreshTimer && clearInterval(this.credentialRefreshTimer)
  }

  /**
   * get credentials for dynamo and s3 requests
   * @see https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithWebIdentity.html
   */
  async refreshCredentials () {
    const url = new URL('https://sts.amazonaws.com')

    url.searchParams.append('Version', '2011-06-15')
    url.searchParams.append('Action', 'AssumeRoleWithWebIdentity')
    this.roleArn && url.searchParams.append('RoleArn', this.roleArn)
    this.roleSessionName && url.searchParams.append('RoleSessionName', this.roleSessionName)
    this.identityToken && url.searchParams.append('WebIdentityToken', this.identityToken)
    // DurationSeconds default is 3600 seconds
    this.credentialDurationSeconds && url.searchParams.append('DurationSeconds', this.credentialDurationSeconds)

    const { statusCode, body } = await request(url, { dispatcher: this.agent })

    const buffer = new BufferList()
    for await (const chunk of body) {
      buffer.append(chunk)
    }
    const bodyString = buffer.slice().toString('utf-8')

    if (statusCode >= 400) {
      this.logger.fatal(`Cannot refresh AWS credentials: AssumeRoleWithWebIdentity failed with HTTP error ${statusCode} and body: ${bodyString}`)
      throw new Error(
        `Cannot refresh AWS credentials: AssumeRoleWithWebIdentity failed with HTTP error ${statusCode} and body: ${bodyString}`
      )
    }

    const response = xml2js(bodyString, { compact: true }).AssumeRoleWithWebIdentityResponse
    this.credentials.keyId = response.AssumeRoleWithWebIdentityResult.Credentials.AccessKeyId._text
    this.credentials.accessKey = response.AssumeRoleWithWebIdentityResult.Credentials.SecretAccessKey._text
    this.credentials.sessionToken = response.AssumeRoleWithWebIdentityResult.Credentials.SessionToken._text
  }

  s3Url (region, bucket, key = '') {
    return 'https://' + bucket + '.s3.' + region + '.amazonaws.com' + key
  }

  async s3Fetch ({ region, bucket, key, offset, length, retries, retryDelay }) {
    if (length !== undefined && length < 1) {
      this.logger.warn({ key }, 'Called s3Fetch with length 0')
      return Buffer.alloc(0)
    }
    if (!retries) { retries = this.s3Options.maxRetries }
    if (!retryDelay) { retryDelay = this.s3Options.retryDelay }

    const url = this.s3Url(region, bucket, '/' + key)
    const plainHeaders = {
      url,
      region,
      keyId: this.credentials.keyId,
      accessKey: this.credentials.accessKey,
      sessionToken: this.credentials.sessionToken,
      service: 's3',
      method: 'GET'
    }
    if (length > 0) {
      if (!offset) { offset = 0 }
      plainHeaders.headers = { range: `bytes=${offset}-${offset + length - 1}` }
    }
    const headers = await signerWorker.run(plainHeaders)

    let attempts = 0
    let err
    do {
      try {
        return await this.s3Request({ url, headers })
      } catch (error) {
        if (error.message === 'NOT_FOUND') {
          this.logger.error({ url }, 'S3 Not Found')
          throw error
        }
        this.logger.debug(`S3 Error, URL: ${url} Error: "${error.message}" attempt ${attempts + 1} / ${retries}`)
        err = error
      }

      await sleep(retryDelay)
    } while (++attempts < retries)

    this.logger.error({ key, err }, `Cannot S3.fetch ${url} after ${attempts} attempts`)
    throw new Error(`Cannot S3.fetch ${url} - ${err.message}`)
  }

  /**
   * @see https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadBucket.html
   */
  async s3HeadBucket ({ region, bucket }) {
    const url = this.s3Url(region, bucket)
    const plainHeaders = {
      url,
      region,
      keyId: this.credentials.keyId,
      accessKey: this.credentials.accessKey,
      sessionToken: this.credentials.sessionToken,
      service: 's3',
      method: 'GET'
    }
    const headers = await signerWorker.run(plainHeaders)

    try {
      await this.s3Request({ url, headers })
      return true
    } catch (err) {
      this.logger.error({ err, bucket }, 'Cannot s3.headBucket')
      throw new Error('s3.headBucket')
    }
  }

  async s3Request ({ url, headers }) {
    const { statusCode, body } = await request(url, {
      method: 'GET',
      headers,
      dispatcher: this.agent
    })

    const buffer = new BufferList()
    for await (const chunk of body) {
      buffer.append(chunk)
    }

    if (statusCode === 404) {
      throw new Error('NOT_FOUND')
    }
    if (statusCode >= 400) {
      const body = buffer.slice().toString('utf-8')
      if (body.includes('ExpiredToken')) {
        await this.refreshCredentials()
      }
      throw new Error(`S3 request error - Status: ${statusCode} Body: ${body} `)
    }

    return buffer.slice()
  }

  /**
   * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html
   */
  async dynamoQueryBySortKey ({ table, keyName, keyValue, retries, retryDelay }) {
    if (!retries) { retries = this.dynamoOptions.maxRetries }
    if (!retryDelay) { retryDelay = this.dynamoOptions.retryDelay }

    const payload = JSON.stringify({
      TableName: table,
      Limit: 1,
      KeyConditionExpression: `${keyName} = :v`,
      ExpressionAttributeValues: { ':v': { S: keyValue } }
    })

    const headers = await signerWorker.run({
      url: this.dynamoUrl,
      region: this.dynamoOptions.region,
      keyId: this.credentials.keyId,
      accessKey: this.credentials.accessKey,
      sessionToken: this.credentials.sessionToken,
      service: 'dynamodb',
      method: 'POST',
      headers: { 'x-amz-target': 'DynamoDB_20120810.Query' },
      payload
    })

    let attempts = 0
    let err
    let record
    do {
      try {
        record = await this.dynamoRequest({ url: this.dynamoUrl, headers, payload })
        break
      } catch (error) {
        this.logger.debug(
          { err: error, table, key: { [keyName]: keyValue } },
          `Cannot Dynamo.Query attempt ${attempts + 1} / ${retries}`
        )
        err = error
      }
      await sleep(retryDelay)
    } while (++attempts < retries)

    if (record?.Items) {
      return record.Items.map(i => unmarshall(i))
    }

    if (!err) { return [] }

    this.logger.error({ err, table, key: { [keyName]: keyValue } }, `Cannot Dynamo.Query after ${attempts} attempts`)
    throw new Error('Dynamo.Query')
  }

  /**
   * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.htm
   */
  async dynamoGetItem ({ table, keyName, keyValue, projection, retries, retryDelay }) {
    if (!retries) { retries = this.dynamoOptions.maxRetries }
    if (!retryDelay) { retryDelay = this.dynamoOptions.retryDelay }

    const request = {
      TableName: table,
      Key: { [keyName]: { S: keyValue } }
    }
    if (projection) { request.ProjectionExpression = projection }
    const payload = JSON.stringify(request)

    const headers = await signerWorker.run({
      url: this.dynamoUrl,
      region: this.dynamoOptions.region,
      keyId: this.credentials.keyId,
      accessKey: this.credentials.accessKey,
      sessionToken: this.credentials.sessionToken,
      service: 'dynamodb',
      method: 'POST',
      headers: { 'x-amz-target': 'DynamoDB_20120810.GetItem' },
      payload
    })

    let attempts = 0
    let err
    let record
    do {
      try {
        record = await this.dynamoRequest({ url: this.dynamoUrl, headers, payload })
        break
      } catch (error) {
        this.logger.debug(
          { err, table, key: { [keyName]: keyValue } },
          `Cannot Dynamo.GetItem attempt ${attempts + 1} / ${retries}`
        )
        err = error
      }
      await sleep(retryDelay)
    } while (++attempts < retries)

    if (record?.Item) {
      return unmarshall(record.Item)
    }

    if (!err) { return }

    this.logger.error({ err, table, key: { [keyName]: keyValue } }, `Cannot Dynamo.GetItem after ${attempts} attempts`)
    throw new Error('Dynamo.GetItem')
  }

  /**
   * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeTable.html
   */
  async dynamoDescribeTable (table) {
    const payload = JSON.stringify({ TableName: table })

    const headers = await signerWorker.run({
      url: this.dynamoUrl,
      region: this.dynamoOptions.region,
      keyId: this.credentials.keyId,
      accessKey: this.credentials.accessKey,
      sessionToken: this.credentials.sessionToken,
      service: 'dynamodb',
      method: 'POST',
      headers: { 'x-amz-target': 'DynamoDB_20120810.DescribeTable' },
      payload
    })

    try {
      await this.dynamoRequest({ url: this.dynamoUrl, headers, payload })
      return true
    } catch (err) {
      this.logger.error({ err, table }, 'Cannot Dynamo.DescribeTable')
      throw new Error('Dynamo.DescribeTable')
    }
  }

  async dynamoRequest ({ url, headers, payload }) {
    const { statusCode, body } = await request(url, {
      method: 'POST',
      path: '/',
      headers: { ...headers, 'content-type': 'application/x-amz-json-1.0' },
      body: payload,
      dispatcher: this.agent
    })

    const buffer = new BufferList()
    for await (const chunk of body) {
      buffer.append(chunk)
    }
    const content = buffer.slice().toString('utf-8')

    if (statusCode >= 400) {
      if (content.includes('ExpiredTokenException')) {
        await this.refreshCredentials()
      }

      throw new Error(`Dynamo request error - Status: ${statusCode} Body: ${content} `)
    }

    return JSON.parse(content)
  }
}

export { Client }
