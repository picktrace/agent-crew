import * as pty from 'node-pty'
import { TerminalRuntime, TerminalProcess } from './terminalRuntime'

export const nodePtyRuntime: TerminalRuntime = {
    start(options): TerminalProcess {
        const ptyProcess = pty.spawn(options.shell, [], {
            cwd: options.folder,
            cols: options.columns,
            rows: options.rows,
        })

        return {
            onData: (listen) => ptyProcess.onData(listen),
            onExit: (listen) => ptyProcess.onExit((event) => listen(event.exitCode, event.signal ?? null)),
            write: (data) => ptyProcess.write(data),
            resize: (cols, rows) => ptyProcess.resize(cols, rows),
            pause: () => ptyProcess.pause(),
            resume: () => ptyProcess.resume(),
            kill: () => ptyProcess.kill(),
        }
    },
}
