import { contextBridge, ipcRenderer } from 'electron'
import { CrewBridge, CrewChannel } from './bridge'

const pickFolderChannel: CrewChannel = 'crew:pickFolder'
const openPaneChannel: CrewChannel = 'crew:openPane'
const drainChannel: CrewChannel = 'crew:drain'

const crew: CrewBridge = {
    pickFolder: () => ipcRenderer.invoke(pickFolderChannel),
    openPane: (folder, columns, rows) => ipcRenderer.invoke(openPaneChannel, folder, columns, rows),
    drain: (paneId) => ipcRenderer.invoke(drainChannel, paneId),
}

contextBridge.exposeInMainWorld('crew', crew)
