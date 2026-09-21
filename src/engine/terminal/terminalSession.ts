import { TerminalProcess, Disposable } from './terminalRuntime'
import { OutputQueue, OutputQueueCounters } from './outputQueue'

export class TerminalSession {
    readonly id: string = crypto.randomUUID()

    private running: boolean = true
    private code: number | null = null
    private signal: number | null = null
    private isClosed: boolean = false

    private readonly dataDisposable: Disposable
    private readonly exitDisposable: Disposable

    constructor(
        private readonly terminalProcess: TerminalProcess,
        private readonly queue: OutputQueue
    ) {
        this.dataDisposable = this.terminalProcess.onData((chunk) => {
            if (this.queue.push(chunk) === 'pause') {
                this.terminalProcess.pause()
            }
        })

        this.exitDisposable = this.terminalProcess.onExit((code, signal) => {
            this.running = false
            this.code = code
            this.signal = signal
        })
    }

    get isRunning(): boolean {
        return this.running
    }

    get exitCode(): number | null {
        return this.code
    }

    get exitSignal(): number | null {
        return this.signal
    }

    drain(): string[] {
        const chunks = this.queue.drain()
        if (this.queue.afterDrain() === 'resume') {
            if (this.running) {
                this.terminalProcess.resume()
            }
        }
        return chunks
    }

    write(data: string): void {
        if (this.running) {
            this.terminalProcess.write(data)
        }
    }

    resize(columns: number, rows: number): void {
        if (this.running) {
            this.terminalProcess.resize(columns, rows)
        }
    }

    counters(): OutputQueueCounters {
        return this.queue.counters()
    }

    close(): void {
        if (this.isClosed) {
            return
        }
        this.isClosed = true
        this.dataDisposable.dispose()
        this.exitDisposable.dispose()

        if (this.running) {
            this.terminalProcess.kill()
        }

        this.running = false
    }
}
