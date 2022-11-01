
import t from 'tap'
import { CID } from 'multiformats/cid'
import {
  Message,
  Block,
  BlockPresence,
  Entry,
  WantList,
  BITSWAP_V_100,
  BITSWAP_V_110,
  BITSWAP_V_120,
  maxPriority,
  BLOCK_TYPE_DATA,
  BLOCK_TYPE_INFO
} from '../src/protocol.js'

const cid = CID.parse('bafybeiccfclkdtucu6y4yc5cpr6y3yuinr67svmii46v5cfcrkp47ihehy')

t.test('Entry', async t => {
  t.test('should create an entry', async t => {
    const entry = new Entry(cid, 0, true, Entry.WantType.Have, true)
    t.ok(entry)
  })

  t.test('should create an entry sanitizind priority #1', async t => {
    const entry = new Entry(cid, -1, true, Entry.WantType.Have, true)
    t.equal(entry.priority, 1)
  })

  t.test('should create an entry sanitizind priority #2', async t => {
    const entry = new Entry(cid, 'not-a-number', true, Entry.WantType.Have, true)
    t.equal(entry.priority, 1)
  })

  t.test('should create an entry sanitizind priority #3', async t => {
    const entry = new Entry(cid, maxPriority + 1, true, Entry.WantType.Have, true)
    t.equal(entry.priority, maxPriority)
  })

  t.test('should create an entry wantType', async t => {
    const entry = new Entry(cid, 1, true, -1, true)
    t.equal(entry.wantType, 0)
  })

  t.test('fromRaw', async t => {
    t.test('shoul create an entry from raw data', async t => {
      const raw = {
        block: new Uint8Array([
          1, 85, 18, 32, 251, 134, 8, 175, 131, 185, 251, 174, 58, 51, 25, 190, 100, 102,
          243, 71, 242, 46, 133, 87, 179, 127, 128, 79, 6, 49, 110, 82, 153, 1, 31, 156
        ]),
        priority: 1,
        cancel: false,
        wantType: Entry.WantType.Block,
        sendDontHave: true
      }

      const entry = Entry.fromRaw(raw)
      t.equal(entry.cid.toString(), 'bafkreih3qyek7a5z7oxdumyzxzsgn42h6ixikv5tp6ae6brrnzjjsai7tq')
      t.equal(entry.priority, 1)
      t.equal(entry.cancel, false)
      t.equal(entry.wantType, Entry.WantType.Block)
      t.equal(entry.sendDontHave, true)
    })

    t.test('shoul create an entry from raw data and protocol 1.0.0', async t => {
      const raw = {
        block: new Uint8Array([
          18, 32, 197, 248, 140, 162, 41, 29, 40, 43, 7, 143, 17, 187, 164, 234,
          91, 201, 182, 194, 238, 6, 69, 1, 189, 11, 223, 117, 209, 133, 212, 128, 220, 243
        ]),
        priority: 1,
        cancel: false,
        wantType: Entry.WantType.Block,
        sendDontHave: true
      }

      const entry = Entry.fromRaw(raw, BITSWAP_V_100)
      t.equal(entry.cid.toString(), 'QmbfSqvUycmA1zG5WAfMfCknSJwbGxDMCnaXF5BieZ7Xnz')
      t.equal(entry.priority, 1)
      t.equal(entry.cancel, false)
      t.equal(entry.wantType, Entry.WantType.Block)
      t.equal(entry.sendDontHave, false)
    })
  })

  t.test('encode', async t => {
    t.test('should be properly sanitized and encoded', async t => {
      t.equal(
        new Entry(cid, -1, true, Entry.WantType.Have, true).encode(BITSWAP_V_120).toString('base64'),
        'CiQBcBIgQiiWoc6Cp7HMC6J8fY3iiGx9+VWIRz1eiKKKn8+g5D4QARgBIAEoAQ=='
      )
    })

    t.test('should be properly sanitized and encoded', async t => {
      t.equal(
        new Entry(cid, maxPriority + 1, true, Entry.WantType.Have, true).encode(BITSWAP_V_120).toString('base64'),
        'CiQBcBIgQiiWoc6Cp7HMC6J8fY3iiGx9+VWIRz1eiKKKn8+g5D4Q/////wcYASABKAE='
      )
    })
  })
})

t.test('WantList', async t => {
  t.test('constructor', async t => {
    t.test('should create wantlist', async t => {
      const wantlist = new WantList([new Entry(cid, 1, false, Entry.WantType.Block, true)])
      t.ok(wantlist)
    })
  })

  t.test('fromRaw', async t => {
    t.test('shoul create a wantlist from raw data', async t => {
      const raw = {
        entries: [
          {
            block: new Uint8Array([
              1, 85, 18, 32, 251, 134, 8, 175, 131, 185, 251, 174, 58, 51, 25, 190, 100, 102,
              243, 71, 242, 46, 133, 87, 179, 127, 128, 79, 6, 49, 110, 82, 153, 1, 31, 156
            ]),
            priority: 1,
            cancel: false
          }
        ],
        full: false
      }

      const wantlist = WantList.fromRaw(raw)
      t.equal(wantlist.full, false)
      t.equal(wantlist.entries[0].cid.toString(), 'bafkreih3qyek7a5z7oxdumyzxzsgn42h6ixikv5tp6ae6brrnzjjsai7tq')
    })

    t.test('shoul create a wantlist from raw data on protocol 1.0.0', async t => {
      const raw = {
        entries: [
          {
            block: new Uint8Array([
              18, 32, 251, 134, 8, 175, 131, 185, 251, 174, 58, 51, 25, 190, 100,
              102, 243, 71, 242, 46, 133, 87, 179, 127, 128, 79, 6, 49, 110, 82, 153, 1, 31, 156
            ]),
            priority: 1,
            cancel: false
          }
        ],
        full: false
      }

      const wantlist = WantList.fromRaw(raw, BITSWAP_V_100)
      t.equal(wantlist.full, false)
      t.equal(wantlist.entries[0].cid.toString(), 'QmfGVahyJZtbWcLa8L3XLnxN5yfS53Cb7CdiEFA61AJ7yV')
    })
  })

  t.test('encode', async t => {
    t.test('should be properly sanitized and encoded', async t => {
      t.equal(new WantList([], true).encode(BITSWAP_V_120).toString('base64'), 'EAE=')
    })
  })
})

t.test('Block', async t => {
  t.test('constructor', async t => {
    t.test('should create a data block', async t => {
      const block = new Block(cid, Buffer.alloc(10))
      t.ok(block)
    })
  })

  t.test('fromRaw', async t => {
    t.test('shoul create a data block from raw data', async t => {
      const raw = {
        prefix: new Uint8Array([1, 85, 18, 32]),
        data: new Uint8Array([49, 50, 51, 52, 10])
      }

      t.same(Block.fromRaw(raw), raw)
    })

    t.test('shoul create a data block from raw data on procol 1.0.0', async t => {
      const raw = {
        prefix: new Uint8Array([1, 85, 18, 32]),
        data: new Uint8Array([49, 50, 51, 52, 10])
      }

      t.same(Block.fromRaw(raw, BITSWAP_V_100), { prefix: null, data: raw })
    })
  })

  t.test('encode', async t => {
    t.test('should be properly sanitized and encoded', async t => {
      t.equal(new Block(cid, Buffer.alloc(10)).encode(BITSWAP_V_120).toString('base64'), 'CgQBcBIgEgoAAAAAAAAAAAAA')
    })
  })
})

t.test('BlockPresence', async t => {
  t.test('constructor', async t => {
    t.test('should create an info block', async t => {
      const block = new BlockPresence(cid, BlockPresence.Type.Have)
      t.ok(block)
    })
  })

  t.test('fromRaw', async t => {
    t.test('shoul create an info block from raw data', async t => {
      const raw = {
        cid: new Uint8Array([1, 112, 18, 32, 186, 3, 55, 134,
          153, 58, 40, 48, 25, 92, 198, 81, 245, 59, 98, 228, 238, 144, 156, 155,
          238, 136, 116, 226, 201, 166, 121, 2, 250, 68, 42, 25
        ]),
        type: 0
      }
      const block = BlockPresence.fromRaw(raw)

      t.equal(block.cid.toString(), 'bafybeif2am3yngj2faybsxggkh2twyxe52ijzg7orb2ofsngpebpurbkde')
      t.equal(block.type, BlockPresence.Type.Have)
    })
  })

  t.test('encode', async t => {
    t.test('should be properly sanitized and encoded', async t => {
      t.equal(
        new BlockPresence(cid, 100).encode(BITSWAP_V_120).toString('base64'),
        'CiQBcBIgQiiWoc6Cp7HMC6J8fY3iiGx9+VWIRz1eiKKKn8+g5D4QAA=='
      )
    })
  })
})

t.test('Message', async t => {
  t.test('constructor', async t => {
    t.test('should create a message with default options', async t => {
      const message = new Message()
      t.equal(message.blocksSize, 16)
    })
  })

  t.test('isEmpty', async t => {
    t.test('should tell a message is empty without entries', async t => {
      const message = new Message()

      t.equal(message.isEmpty(), true)
    })

    t.test('should tell a message is empty with entries', async t => {
      const message = new Message(new WantList([new Entry(cid, 1, false, Entry.WantType.Block, true)]))

      t.equal(message.isEmpty(), false)
    })
  })

  t.test('push', async t => {
    t.test('should push a data block to the message', async t => {
      const message = new Message()

      const block = {
        cid,
        type: BLOCK_TYPE_DATA,
        data: { found: true, content: 'the-data' }
      }
      message.push(block, 123)

      t.equal(message.size(), 149)
      t.equal(message.encode().toString('base64'), 'CgIQARoOCgQBcBIgEga2F751q1ooAA==')
    })

    t.test('should push a data block not found to the message', async t => {
      const message = new Message()

      const block = {
        cid,
        type: BLOCK_TYPE_DATA,
        data: { notFound: true },
        sendDontHave: true
      }
      message.push(block, 123)

      t.equal(message.size(), 143)
      t.equal(message.encode().toString('base64'), 'CgIQASIoCiQBcBIgQiiWoc6Cp7HMC6J8fY3iiGx9+VWIRz1eiKKKn8+g5D4QASgA')
    })

    t.test('should push a data block not found, without sending it, to the message', async t => {
      const message = new Message()

      const block = {
        cid,
        type: BLOCK_TYPE_DATA,
        data: { notFound: true },
        sendDontHave: false
      }
      message.push(block, 123)

      t.equal(message.size(), 16)
      t.equal(message.encode().toString('base64'), 'CgIQASgA')
    })

    t.test('should push an info block to the message', async t => {
      const message = new Message()

      const block = {
        cid,
        type: BLOCK_TYPE_INFO,
        info: { found: true }
      }
      message.push(block, 12)

      t.equal(message.size(), 32)
      t.equal(message.encode().toString('base64'), 'CgIQASIoCiQBcBIgQiiWoc6Cp7HMC6J8fY3iiGx9+VWIRz1eiKKKn8+g5D4QACgA')
    })

    t.test('should push an info block not found to the message', async t => {
      const message = new Message()

      const block = {
        cid,
        type: BLOCK_TYPE_INFO,
        info: { notFound: true },
        sendDontHave: false
      }
      message.push(block, 12)

      t.equal(message.size(), 16)
      t.equal(message.encode().toString('base64'), 'CgIQASgA')
    })

    t.test('should push an info block not found, without sending it, to the message', async t => {
      const message = new Message()

      const block = {
        cid,
        type: BLOCK_TYPE_INFO,
        info: { notFound: true },
        sendDontHave: true
      }
      message.push(block, 12)

      t.equal(message.size(), 32)
      t.equal(message.encode().toString('base64'), 'CgIQASIoCiQBcBIgQiiWoc6Cp7HMC6J8fY3iiGx9+VWIRz1eiKKKn8+g5D4QASgA')
    })

    t.test('should push a data block with cancel to the message', async t => {
      const message = new Message()

      const block = {
        cancel: true
      }
      message.push(block)

      t.equal(message.size(), 16)
      t.equal(message.encode().toString('base64'), 'CgIQASgA')
    })
  })

  t.test('decode', async t => {
    t.test('should decode a message', async t => {
      const encoded = new Uint8Array([
        10, 2, 16, 1, 34, 40, 10, 36, 1, 112, 18, 32, 229, 54, 199, 248, 141,
        115, 31, 55, 77, 204, 181, 104, 175, 246, 245, 110, 131, 138, 25, 56,
        46, 72, 128, 57, 177, 202, 138, 210, 89, 158, 130, 254, 16, 1, 40, 0
      ])

      const decoded = Message.decode(encoded)

      t.same(decoded.wantlist.entries, [])
      t.equal(decoded.wantlist.full, true)
      t.same(decoded.blocks, [])
      t.equal(decoded.blockPresences[0].cid.toString(), 'bafybeihfg3d7rdltd43u3tfvncx7n5loqofbsobojcadtmokrljfthuc7y')
      t.equal(decoded.pendingBytes, 0)
      t.equal(decoded.blocksSize, 58)
    })

    t.test('should decode a message on protocol 1.0.0', async t => {
      const encoded = new Uint8Array([
        10, 2, 16, 1, 34, 40, 10, 36, 1, 85, 18, 32, 168, 131, 218, 252, 72, 13, 70, 110, 224, 78, 13, 109,
        169, 134, 189, 120, 235, 31, 221, 33, 120, 208, 70, 147, 114, 61, 163, 168, 249, 93, 66, 244, 16, 0, 34, 40,
        10, 36, 1, 112, 18, 32, 186, 3, 55, 134, 153, 58, 40, 48, 25, 92, 198, 81, 245, 59, 98, 228, 238, 144,
        156, 155, 238, 136, 116, 226, 201, 166, 121, 2, 250, 68, 42, 25, 16, 0, 40, 0
      ])

      const decoded = Message.decode(encoded, BITSWAP_V_100)

      t.same(decoded.wantlist.entries, [])
      t.equal(decoded.wantlist.full, true)
      t.same(decoded.blocks, [])
      t.same(decoded.blockPresences, [])
      t.equal(decoded.pendingBytes, 0)
      t.equal(decoded.blocksSize, 16)
    })
  })

  t.test('encode', async t => {
    t.test('should encode a message', async t => {
      const wantlist = new WantList([new Entry(cid, 1, false, Entry.WantType.Block, true)])
      const blocksData = [new Block(cid, 'data')]
      const blocksInfo = [new BlockPresence(cid, BlockPresence.Type.Have)]

      const message = new Message(wantlist, blocksData, blocksInfo)

      t.equal(message.encode(BITSWAP_V_120).toString('base64'), 'CjIKLgokAXASIEIolqHOgqexzAuifH2N4ohsfflViEc9Xoiiip/PoOQ+EAEYACAAKAEQABoLCgQBcBIgEgN1q1oiKAokAXASIEIolqHOgqexzAuifH2N4ohsfflViEc9Xoiiip/PoOQ+EAAoAA==')
    })

    t.test('should encode a message on protocol 1.1.0', async t => {
      const wantlist = new WantList([new Entry(cid, 1, false, Entry.WantType.Block, true)])
      const blocksData = [new Block(cid, 'data')]
      const blocksInfo = [new BlockPresence(cid, BlockPresence.Type.Have)]

      const message = new Message(wantlist, blocksData, blocksInfo)

      t.equal(message.encode(BITSWAP_V_110).toString('base64'), 'Ci4KKgokAXASIEIolqHOgqexzAuifH2N4ohsfflViEc9Xoiiip/PoOQ+EAEYABAAGgsKBAFwEiASA3WrWiIoCiQBcBIgQiiWoc6Cp7HMC6J8fY3iiGx9+VWIRz1eiKKKn8+g5D4QACgA')
    })

    t.test('should encode a message on protocol 1.0.0', async t => {
      const wantlist = new WantList([new Entry(cid, 1, false, Entry.WantType.Block, true)])
      const blocksData = [new Block(cid, 'data')]
      const blocksInfo = [new BlockPresence(cid, BlockPresence.Type.Have)]

      const message = new Message(wantlist, blocksData, blocksInfo)

      t.equal(message.encode(BITSWAP_V_100).toString('base64'), 'CiwKKAoiEiBCKJahzoKnscwLonx9jeKIbH35VYhHPV6Iooqfz6DkPhABGAAQABIDdata')
    })
  })

  t.test('send', async t => {
    t.test('should send a message', async t => {
      t.plan(1)

      const blocksData = [new Block(cid, 'data')]
      const blocksInfo = [new BlockPresence(cid, BlockPresence.Type.Have)]

      const message = new Message(undefined, blocksData, blocksInfo)

      const context = {
        connection: {
          send: async (encoded) => {
            t.equal(encoded.toString('base64'), 'CgIQARoLCgQBcBIgEgN1q1oiKAokAXASIEIolqHOgqexzAuifH2N4ohsfflViEc9Xoiiip/PoOQ+EAAoAA==')
          }
        }
      }

      message.send(context)
    })

    t.test('should not send an empty message', async t => {
      const message = new Message()

      const context = {
        connection: {
          send: async () => {
            t.fail('must not send an empty message')
          }
        }
      }

      message.send(context)
    })
  })
})
