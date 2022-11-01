
import t from 'tap'
// eslint-disable-next-line import/no-named-default
import { default as signerWorker } from '../src/aws-client/signer-worker.cjs'

t.test('should sign headers with sessionToken', async t => {
  const headers = signerWorker({
    region: 'us-west-2',
    keyId: 'keyId',
    accessKey: 'accessKey',
    sessionToken: 'the-token',
    service: 's3',
    method: 'POST',
    url: 'https://bucket.s3.us-west-2.amazonaws.com',
    headers: {}
  })
  t.equal(headers['x-amz-security-token'], 'the-token')
  t.match(headers.authorization, /AWS4-HMAC-SHA256 Credential=keyId\/\d+\/us-west-2\/s3\/aws4_request,SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-security-token,Signature=[\da-f]+/)
})

t.test('should sign headers without sessionToken', async t => {
  const headers = signerWorker({
    region: 'us-west-2',
    keyId: 'keyId',
    accessKey: 'accessKey',
    service: 's3',
    method: 'POST',
    url: 'https://bucket.s3.us-west-2.amazonaws.com',
    headers: {}
  })
  t.equal(headers['x-amz-security-token'], undefined)
})

t.test('should sign headers with a payload', async t => {
  const headers = signerWorker({
    region: 'us-west-2',
    keyId: 'keyId',
    accessKey: 'accessKey',
    service: 's3',
    method: 'POST',
    url: 'https://bucket.s3.us-west-2.amazonaws.com',
    headers: {},
    payload: 'something-to-send'
  })
  t.equal(headers['x-amz-content-sha256'], undefined)
})

t.test('should sign headers without a payload', async t => {
  const headers = signerWorker({
    region: 'us-west-2',
    keyId: 'keyId',
    accessKey: 'accessKey',
    service: 's3',
    method: 'POST',
    url: 'https://bucket.s3.us-west-2.amazonaws.com',
    headers: {}
  })
  t.equal(headers['x-amz-content-sha256'], 'UNSIGNED-PAYLOAD')
})
