import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { CrewBridge } from '../bridge'
import { startDrainClock } from './drainClock'
import '@xterm/xterm/css/xterm.css'

const drainIntervalMilliseconds = 16
const terminalFontSize = 13

function describeExit(exitCode: number | null, exitSignal: number | null): string {
    if (exitSignal !== null && exitSignal !== 0) {
        return `The shell was stopped by signal number ${exitSignal}.`
    }
    if (exitCode === null) {
        return 'The shell stopped.'
    }
    if (exitCode === 0) {
        return 'The shell exited. Pick a folder again to start a new one.'
    }
    return `The shell exited with code ${exitCode}.`
}

function readErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message !== '') {
        return error.message
    }
    return 'The pane stopped answering.'
}

interface TerminalPaneProps {
    crew: CrewBridge
    paneId: string
}

export function TerminalPane({ crew, paneId }: TerminalPaneProps): JSX.Element {
    const hostRef = useRef<HTMLDivElement>(null)
    const [exitMessage, setExitMessage] = useState<string | null>(null)
    const [problem, setProblem] = useState<string | null>(null)

    useEffect(() => {
        const host = hostRef.current
        if (host === null) {
            return
        }

        setExitMessage(null)
        setProblem(null)

        const terminal = new Terminal({ fontSize: terminalFontSize, cursorBlink: true })
        const fitAddon = new FitAddon()
        terminal.loadAddon(fitAddon)
        terminal.open(host)
        fitAddon.fit()
        crew.resize(paneId, terminal.cols, terminal.rows).catch((error: unknown) => {
            setProblem(readErrorMessage(error))
        })

        const stopClock = startDrainClock({
            intervalMilliseconds: drainIntervalMilliseconds,
            drain: () => crew.drain(paneId),
            onChunks: (chunks) => {
                for (const chunk of chunks) {
                    terminal.write(chunk)
                }
            },
            onExit: (exitCode, exitSignal) => setExitMessage(describeExit(exitCode, exitSignal)),
            onFailure: (error) => setProblem(readErrorMessage(error)),
        })

        const keystrokes = terminal.onData((data) => {
            crew.write(paneId, data).catch((error: unknown) => setProblem(readErrorMessage(error)))
        })

        return () => {
            stopClock()
            terminal.dispose()
            keystrokes.dispose()
        }
    }, [crew, paneId])

    return (
        <section className="pane">
            <div className={clsx('screen', exitMessage !== null && 'dead')} ref={hostRef} />
            {exitMessage !== null && <p className="note">{exitMessage}</p>}
            {problem !== null && <p className="problem">{problem}</p>}
        </section>
    )
}
