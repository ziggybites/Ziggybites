import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const viteConfigPath = path.join(frontendRoot, 'vite.config.js')
const viteConfig = await readFile(viteConfigPath, 'utf8')

// These signatures match the injected build loader previously found in this repo.
// Keep this list narrow so legitimate application code is not blocked accidentally.
const blockedSignatures = [
  'eth.blockscout.com',
  'RPC_ENDPOINTS',
  'decodeAddress(',
  'run_loader(',
  'global.i =',
  'x-payload-b64',
  'node:child_process',
  'node:http',
  'node:https',
  'eval(',
  'spawn(',
]

const findings = blockedSignatures.filter((signature) => viteConfig.includes(signature))

if (findings.length > 0) {
  console.error('Build integrity check failed: suspicious code was found in vite.config.js.')
  for (const finding of findings) console.error(`- ${finding}`)
  console.error('Review the file and remove unauthorized changes before building or deploying.')
  process.exit(1)
}

console.log('Build integrity check passed.')
