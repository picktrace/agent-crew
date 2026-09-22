import { contextBridge, ipcRenderer } from 'electron'
import { CrewBridge, CrewChannel } from './bridge'

const pickFolderChannel: CrewChannel = 'crew:pickFolder'
const openPaneChannel: CrewChannel = 'crew:openPane'

const crew: CrewBridge = {
    pickFolder: () => ipcRenderer.invoke(pickFolderChannel),
    openPane: (folder, columns, rows) => ipcRenderer.invoke(openPaneChannel, folder, columns, rows),
}

contextBridge.exposeInMainWorld('crew', crew)
