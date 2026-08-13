import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const command = process.argv[2] || 'list'
const port = Number(process.env.PORT || process.argv[3] || 4000)

async function getPortPids(targetPort) {
  const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'tcp'])
  const lines = stdout.split(/\r?\n/)
  const matcher = new RegExp(`[:.]${targetPort}\\s+.*LISTENING\\s+(\\d+)`, 'i')
  const pids = new Set()

  for (const line of lines) {
    const match = line.match(matcher)
    if (match?.[1]) pids.add(match[1])
  }

  return [...pids]
}

async function listPort() {
  const pids = await getPortPids(port)
  if (!pids.length) {
    console.log(`No process is listening on port ${port}.`)
    return
  }

  console.log(`Port ${port} is used by PID(s): ${pids.join(', ')}`)
}

async function killPort() {
  const pids = await getPortPids(port)
  if (!pids.length) {
    console.log(`No process is listening on port ${port}.`)
    return
  }

  for (const pid of pids) {
    await execFileAsync('taskkill.exe', ['/PID', pid, '/F'])
    console.log(`Stopped PID ${pid} on port ${port}.`)
  }
}

if (command === 'kill') {
  killPort()
} else {
  listPort()
}
