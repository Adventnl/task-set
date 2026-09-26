// First deployment of Task Set. A new Worker must receive its required secrets with the deploy,
// so this asks for the passcode (without echoing it), generates the session secret, and passes
// both through a private temporary file that is deleted afterwards. Extra arguments go to
// `wrangler deploy` (for example --dry-run). Later deploys use `npm run deploy`.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import readline from 'node:readline'
import { Writable } from 'node:stream'

const MIN_PASSCODE_LENGTH = 12

let muted = false
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding)
    callback()
  },
})
const prompt = readline.createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) })
const lines = prompt[Symbol.asyncIterator]()

async function askHidden(question) {
  process.stdout.write(question)
  muted = true
  const { value = '' } = await lines.next()
  muted = false
  process.stdout.write('\n')
  return value
}

const passcode = await askHidden(`Choose a passcode for signing in (at least ${MIN_PASSCODE_LENGTH} characters): `)
if (passcode.length < MIN_PASSCODE_LENGTH) {
  console.error(`The passcode must be at least ${MIN_PASSCODE_LENGTH} characters. Nothing was deployed.`)
  process.exit(1)
}
if ((await askHidden('Type it again: ')) !== passcode) {
  console.error('The passcodes did not match. Nothing was deployed.')
  process.exit(1)
}
prompt.close()

const directory = mkdtempSync(join(tmpdir(), 'task-set-'))
const secretsFile = join(directory, 'secrets.json')
try {
  const secrets = { APP_PASSCODE: passcode, SESSION_SECRET: randomBytes(32).toString('hex') }
  writeFileSync(secretsFile, JSON.stringify(secrets), { mode: 0o600 })
  execFileSync('npx', ['wrangler', 'deploy', '--secrets-file', secretsFile, ...process.argv.slice(2)], { stdio: 'inherit' })
} finally {
  rmSync(directory, { recursive: true, force: true })
}
