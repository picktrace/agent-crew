export interface Disposable {
    dispose(): void
}

export interface TerminalProcess {
    onData(listen: (chunk: string) => void): Disposable
    onExit(listen: (exitCode: number, signal: number | null) => void): Disposable
    write(data: string): void
    resize(columns: number, rows: number): void
    pause(): void
    resume(): void
    kill(): void
}

export interface TerminalStartOptions {
    shell: string
    args: string[]
    folder: string
    columns: number
    rows: number
}

export interface TerminalRuntime {
    start(options: TerminalStartOptions): TerminalProcess
}
