
// eslint-disable-next-line import/no-named-default
import { default as Docker } from 'dockerode'

const _driver = new Docker()

export async function getContainer (containerName) {
  if (!containerName) {
    throw new Error('MISSING_CONTAINER_NAME')
  }

  const containers = await _driver.listContainers({ all: true })
  const container = containers.find(c => c.Names.includes('/' + containerName))
  if (container) {
    return _driver.getContainer(container.Id)
  }
}
export async function build ({ override, cwd, dockerfile = 'Dockerfile', imageName, containerName, ports, envs }) {
  if (override) {
    const images = await _driver.listImages({ all: true })
    const imageMeta = images.find(i => i.RepoTags.some(name => name.startsWith(imageName)))
    if (imageMeta) {
      const image = _driver.getImage(imageMeta.RepoTags[0])
      await image.remove({ force: true })
    }
  }

  const s = await _driver.buildImage({
    context: cwd,
    src: [dockerfile]
  }, { t: imageName })

  await new Promise((resolve, reject) => {
    _driver.modem.followProgress(s, (err, res) => err ? reject(err) : resolve(res))
  })

  const [hostPort, containerPort] = ports.split(':')

  if (override) {
    const container = await getContainer(containerName)
    if (container) {
      await container.remove({ force: true })
    }
  }

  return _driver.createContainer({
    Image: imageName,
    name: containerName,
    Env: envs,
    HostConfig: { NetworkMode: 'host' },
    PortBindings: { [containerPort + '/tcp']: [{ HostPort: String(hostPort) }] }
  })
}

export async function start (container) {
  const info = await container.inspect()
  if (info && info.State.Status !== 'running') {
    await container.start()
  }
}

export async function stop (container) {
  const info = await container.inspect()
  if (info && info.State.Status === 'running') {
    await container.stop()
  }
}
