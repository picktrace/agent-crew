import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { CrewChannel } from './bridge'

let mainWindow: BrowserWindow | null = null
const pickFolderChannel: CrewChannel = 'crew:pickFolder'

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
