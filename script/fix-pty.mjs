import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// pnpm drops the execute bit on node-pty's spawn-helper when it unpacks the
// tarball. Without that bit every pty.spawn fails with "posix_spawnp failed".
// The binary is also ad-hoc signed, so once it is executable macOS scans it and
// warns that it is not trusted. Signing it locally stops that.
const roots = ['node_modules/node-pty/prebuilds', 'node_modules/.pnpm']
const isMac = process.platform === 'darwin'

const findHelpers = (directory, found = []) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) findHelpers(path, found)
        else if (entry.name === 'spawn-helper') found.push(path)
    }
    return found
}

let madeExecutable = 0
let signed = 0

for (const root of roots) {
    if (!existsSync(root)) continue
    let helpers = []
    try {
        helpers = findHelpers(root)
    } catch {
        continue
    }
    for (const path of helpers) {
        if ((statSync(path).mode & 0o111) === 0) {
            chmodSync(path, 0o755)
            madeExecutable += 1
        }
        if (!isMac) continue
        try {
            execFileSync('codesign', ['--force', '--sign', '-', '--timestamp=none', path], { stdio: 'ignore' })
            execFileSync('xattr', ['-d', 'com.apple.provenance', path], { stdio: 'ignore' })
            signed += 1
        } catch {
            // codesign is missing, or the attribute was already gone. Neither blocks an install.
        }
    }
}

if (madeExecutable > 0) console.log(`fix-pty: made ${madeExecutable} spawn-helper file(s) executable`)
if (signed > 0) console.log(`fix-pty: signed ${signed} spawn-helper file(s) for this machine`)
