import { contextBridge, ipcRenderer } from 'electron'
import { CrewBridge, CrewChannel } from './bridge'

const pickFolderChannel: CrewChannel = 'crew:pickFolder'
const openPaneChannel: CrewChannel = 'crew:openPane'
const drainChannel: CrewChannel = 'crew:drain'
const writeChannel: CrewChannel = 'crew:write'
const resizeChannel: CrewChannel = 'crew:resize'

const crew: CrewBridge = {
    pickFolder: () => ipcRenderer.invoke(pickFolderChannel),
    openPane: (folder, columns, rows) => ipcRenderer.invoke(openPaneChannel, folder, columns, rows),
    drain: (paneId) => ipcRenderer.invoke(drainChannel, paneId),
    write: (paneId, data) => ipcRenderer.invoke(writeChannel, paneId, data),
    resize: (paneId, columns, rows) => ipcRenderer.invoke(resizeChannel, paneId, columns, rows),
}

contextBridge.exposeInMainWorld('crew', crew)
