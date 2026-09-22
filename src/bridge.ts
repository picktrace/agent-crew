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
    openPane(folder: string, columns: number, rows: number): Promise<string>
    drain(paneId: string): Promise<PaneDrain>
}

export type CrewChannel = 'crew:pickFolder' | 'crew:openPane' | 'crew:drain'

declare global {
    interface Window {
        crew?: CrewBridge
    }
}
