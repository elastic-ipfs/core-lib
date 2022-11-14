import { MockAgent } from 'undici'
import getPort from 'get-port'

import * as docker from './docker.js'

/**
 * @deprecated use DynamoLocal instead
 */
export function createMockAgent () {
  const mockAgent = new MockAgent()
  mockAgent.disableNetConnect()

  return mockAgent
}

export function dummyLogger () {
  return { fatal: noop, error: noop, warn: noop, info: noop, debug: noop }
}

export function spyLogger () {
  const spy = { messages: {} }
  for (const l of ['fatal', 'error', 'error', 'warn', 'info', 'debug']) {
    spy.messages[l] = []
    spy[l] = (...args) => { spy.messages[l].push(args) }
  }
  return spy
}

function noop () { }

export async function startDynamo ({ port, expose, cwd, imageName, containerName }) {
  if (!expose) {
    expose = await getPort()
  }
  const container = await docker.build({
    override: true,
    cwd,
    imageName,
    containerName,
    ports: `${expose}:${port}`
  })
  await docker.start(container)
  // TODO! ping untill can connect

  return { container, port: expose }
}

export async function stopDynamo (container) {
  await docker.stop(container)
}
