export interface CrewBridge {
    pickFolder(): Promise<string | null>
}

export type CrewChannel = 'crew:pickFolder'

declare global {
    interface Window {
        crew?: CrewBridge
    }
}
