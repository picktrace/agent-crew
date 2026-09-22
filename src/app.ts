import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { CrewChannel } from './bridge'
import { resolveShell } from './engine/shell'
import { OutputQueue } from './engine/terminal/outputQueue'
import { nodePtyRuntime } from './engine/terminal/nodePtyRuntime'
import { TerminalSession } from './engine/terminal/terminalSession'

let mainWindow: BrowserWindow | null = null
let session: TerminalSession | null = null
const pickFolderChannel: CrewChannel = 'crew:pickFolder'
const openPaneChannel: CrewChannel = 'crew:openPane'

// node-pty hands us about 64 KB at a time. pauseAt must sit above one of those
// bursts, or we pause on every burst. dropAt must sit above pauseAt plus one
// burst, because the burst already in flight when we pause still arrives after it.
const pauseAtCharacters = 1048576
const dropAtCharacters = 4194304

function openPane(folder: string, columns: number, rows: number): string {
    if (session !== null) {
        session.close()
    }

    // oxlint-disable-next-line node/no-process-env
    const shell = resolveShell(process.env, process.platform)
    const terminalProcess = nodePtyRuntime.start({ shell, folder, columns, rows })
    const queue = new OutputQueue(pauseAtCharacters, dropAtCharacters)

    session = new TerminalSession(terminalProcess, queue)
    return session.id
}

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

app.whenReady().then(() => {
    ipcMain.handle(pickFolderChannel, () => pickFolder())
    ipcMain.handle(openPaneChannel, (_event, folder, columns, rows) => openPane(folder, columns, rows))
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
