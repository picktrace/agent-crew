export interface CrewBridge {
    pickFolder(): Promise<string | null>
    openPane(folder: string, columns: number, rows: number): Promise<string>
}

export type CrewChannel = 'crew:pickFolder' | 'crew:openPane'

declare global {
    interface Window {
        crew?: CrewBridge
    }
}
