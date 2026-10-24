import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'

// Keep production's hosted AI binding out of offline local development. No production config is changed.
const configuration = JSON.parse(
  readFileSync('wrangler.jsonc', 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n'),
)
delete configuration.ai
delete configuration.account_id
delete configuration.routes
delete configuration.previews
configuration.main = resolve(configuration.main)
configuration.assets.directory = resolve(configuration.assets.directory)
mkdirSync('.wrangler', { recursive: true })
writeFileSync('.wrangler/local-dev.json', JSON.stringify(configuration))
if (!existsSync('.dev.vars'))
  writeFileSync(
    '.dev.vars',
    `APP_PASSCODE="${randomBytes(24).toString('hex')}"\nSESSION_SECRET="${randomBytes(32).toString('hex')}"\n`,
    { flag: 'wx', mode: 0o600 },
  )
const child = spawn(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'dev',
    '--config',
    '.wrangler/local-dev.json',
    '--env-file',
    '.dev.vars',
    '--ip',
    '127.0.0.1',
    ...process.argv.slice(2),
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME ?? '/tmp/task-set-config',
      WRANGLER_SEND_METRICS: 'false',
    },
  },
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal))
child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
