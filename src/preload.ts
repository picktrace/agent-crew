import { contextBridge, ipcRenderer } from 'electron'
import { CrewBridge, CrewChannel } from './bridge'

const pickFolderChannel: CrewChannel = 'crew:pickFolder'

const crew: CrewBridge = {
    pickFolder: () => ipcRenderer.invoke(pickFolderChannel),
}

contextBridge.exposeInMainWorld('crew', crew)
