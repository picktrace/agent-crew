import type { PaneProgram } from './engine/shell'

export type { PaneProgram }

export interface PaneCounters {
    queuedCharacters: number
    peakQueuedCharacters: number
    droppedChunks: number
    droppedCharacters: number
}

export interface PaneDrain {
    chunks: string[]
    isRunning: boolean
    exitCode: number | null
    exitSignal: number | null
    counters: PaneCounters
}

export interface CrewBridge {
    pickFolder(): Promise<string | null>
    openPane(folder: string, columns: number, rows: number, program: PaneProgram): Promise<string>
    drain(paneId: string): Promise<PaneDrain>
    write(paneId: string, data: string): Promise<void>
    resize(paneId: string, columns: number, rows: number): Promise<void>
}

export type CrewChannel = 'crew:pickFolder' | 'crew:openPane' | 'crew:drain' | 'crew:write' | 'crew:resize'

declare global {
    interface Window {
        crew?: CrewBridge
    }
}
