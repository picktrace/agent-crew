import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { copyFile, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { CrewChannel, PaneDrain } from './bridge'
import { PaneProgram, readPermissionMode, resolveLaunchArguments, resolveShell } from './engine/shell'
import { OutputQueue } from './engine/terminal/outputQueue'
import { nodePtyRuntime } from './engine/terminal/nodePtyRuntime'
import { TerminalSession } from './engine/terminal/terminalSession'
import { isTrustEnabled, trustFolder } from './engine/trust'

let mainWindow: BrowserWindow | null = null
let session: TerminalSession | null = null
const pickFolderChannel: CrewChannel = 'crew:pickFolder'
const openPaneChannel: CrewChannel = 'crew:openPane'
const drainChannel: CrewChannel = 'crew:drain'
const writeChannel: CrewChannel = 'crew:write'
const resizeChannel: CrewChannel = 'crew:resize'

async function pickFolder(): Promise<string | null> {
    if (mainWindow === null) {
        return null
    }

    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    const folder = result.filePaths[0]
    if (result.canceled || folder === undefined) {
        return null
    }
    return folder
}

// node-pty hands us about 64 KB at a time. pauseAt must sit above one of those
// bursts, or we pause on every burst. dropAt must sit above pauseAt plus one
// burst, because the burst already in flight when we pause still arrives after it.
const pauseAtCharacters = 1048576
const dropAtCharacters = 4194304

// copyFile's flag for "fail if the target exists". The first backup is the one
// worth keeping, so a later run must never overwrite it.
const doNotOverwrite = 1

async function trustPickedFolder(folder: string): Promise<void> {
    // oxlint-disable-next-line node/no-process-env
    if (!isTrustEnabled(process.env)) {
        return
    }

    const path = join(homedir(), '.claude.json')

    let raw: string
    try {
        raw = await readFile(path, 'utf8')
    } catch {
        return
    }

    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        return
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return
    }

    const outcome = trustFolder(parsed, folder)
    if (!outcome.changed) {
        return
    }

    try {
        await copyFile(path, `${path}.crew-backup`, doNotOverwrite)
    } catch {
        // A backup is already there, from an earlier run. That is the one to keep.
    }

    // Two spaces and no trailing newline, because that is how Claude Code writes
    // this file. Matching it keeps the change to one line instead of 4893.
    const temporary = `${path}.crew-tmp`
    await writeFile(temporary, JSON.stringify(outcome.config, null, 2), 'utf8')
    await rename(temporary, path)
}

function openPane(folder: string, columns: number, rows: number, program: PaneProgram): string {
    if (session !== null) {
        session.close()
    }

    // oxlint-disable-next-line node/no-process-env
    const shell = resolveShell(process.env, process.platform)
    // oxlint-disable-next-line node/no-process-env
    const mode = readPermissionMode(process.env)
    const args = resolveLaunchArguments(program, process.platform, mode)
    const terminalProcess = nodePtyRuntime.start({ shell, args, folder, columns, rows })
    const queue = new OutputQueue(pauseAtCharacters, dropAtCharacters)

    session = new TerminalSession(terminalProcess, queue)
    return session.id
}

function drain(paneId: string): PaneDrain {
    if (session === null || session.id !== paneId) {
        throw new Error(`no pane with id ${paneId}`)
    }

    return {
        chunks: session.drain(),
        isRunning: session.isRunning,
        exitCode: session.exitCode,
        exitSignal: session.exitSignal,
        counters: session.counters(),
    }
}

function write(paneId: string, data: string): void {
    if (session === null || session.id !== paneId) {
        throw new Error(`no pane with id ${paneId}`)
    }
    session.write(data)
}

function resize(paneId: string, columns: number, rows: number): void {
    if (session === null || session.id !== paneId) {
        throw new Error(`no pane with id ${paneId}`)
    }
    session.resize(columns, rows)
}

app.whenReady().then(() => {
    ipcMain.handle(pickFolderChannel, () => pickFolder())
    ipcMain.handle(openPaneChannel, async (_event, folder, columns, rows, program) => {
        if (program === 'agent') {
            await trustPickedFolder(folder)
        }
        return openPane(folder, columns, rows, program)
    })
    ipcMain.handle(drainChannel, (_event, paneId) => drain(paneId))
    ipcMain.handle(writeChannel, (_event, paneId, data) => write(paneId, data))
    ipcMain.handle(resizeChannel, (_event, paneId, columns, rows) => resize(paneId, columns, rows))

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: join(import.meta.dirname, '../preload/preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    })
    mainWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'))
})
