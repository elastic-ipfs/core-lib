import { MockAgent } from 'undici'

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
