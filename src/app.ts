import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

let mainWindow: BrowserWindow | null = null

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({ width: 1280, height: 800 })
    mainWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'))
})
