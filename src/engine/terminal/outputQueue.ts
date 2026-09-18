export interface OutputQueueCounters {
    queuedCharacters: number
    peakQueuedCharacters: number
    droppedChunks: number
    droppedCharacters: number
}

export type FlowSignal = 'pause' | 'resume' | null

export class OutputQueue {
    private queue: string[] = []
    private readonly pauseAtCharacters: number
    private readonly dropAtCharacters: number

    private queuedCharacters = 0
    private peakQueuedCharacters = 0
    private droppedChunks = 0
    private droppedCharacters = 0
    private paused = false

    constructor(pauseAtCharacters: number, dropAtCharacters: number) {
        this.pauseAtCharacters = pauseAtCharacters
        this.dropAtCharacters = dropAtCharacters
    }

    push(chunk: string): FlowSignal {
        this.queue.push(chunk)
        this.queuedCharacters += chunk.length

        if (this.queuedCharacters > this.peakQueuedCharacters) {
            this.peakQueuedCharacters = this.queuedCharacters
        }

        while (this.queuedCharacters > this.dropAtCharacters) {
            const oldest = this.queue.shift()
            if (oldest === undefined) {
                break
            }
            this.queuedCharacters -= oldest.length
            this.droppedChunks += 1
            this.droppedCharacters += oldest.length
        }

        if (!this.paused && this.queuedCharacters >= this.pauseAtCharacters) {
            this.paused = true
            return 'pause'
        }
        return null
    }

    drain(): string[] {
        const chunks = this.queue
        this.queue = []
        this.queuedCharacters = 0
        return chunks
    }

    afterDrain(): FlowSignal {
        const wasPaused = this.paused
        this.paused = false
        return wasPaused ? 'resume' : null
    }

    counters(): OutputQueueCounters {
        return {
            queuedCharacters: this.queuedCharacters,
            peakQueuedCharacters: this.peakQueuedCharacters,
            droppedChunks: this.droppedChunks,
            droppedCharacters: this.droppedCharacters,
        }
    }
}
