import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (match && process.env[match[1]] === undefined) {
    process.env[match[1]] = match[2]
  }
}
