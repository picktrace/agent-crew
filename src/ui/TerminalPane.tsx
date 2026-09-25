import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { CrewBridge, PaneProgram } from '../bridge'
import { PaneStatus, readPaneStatus } from '../engine/paneStatus'
import { startDrainClock } from './drainClock'
import '@xterm/xterm/css/xterm.css'

const drainIntervalMilliseconds = 16
const terminalFontSize = 13

interface PaneExit {
    code: number | null
    signal: number | null
}

function nameProgram(program: PaneProgram): string {
    return program === 'agent' ? 'Claude Code' : 'The shell'
}

function describeExit(program: PaneProgram, exit: PaneExit): string {
    const name = nameProgram(program)
    if (exit.signal !== null && exit.signal !== 0) {
        return `${name} was stopped by signal number ${exit.signal}.`
    }
    if (exit.code === null) {
        return `${name} stopped.`
    }
    if (exit.code === 0) {
        return `${name} exited. Pick a folder to start it again.`
    }
    return `${name} exited with code ${exit.code}.`
}

function describeStatus(status: PaneStatus, program: PaneProgram, exit: PaneExit | null): string | null {
    if (status === 'starting') {
        if (program === 'agent') {
            return 'Starting Claude Code. Your shell reads your profile first, so this takes a second.'
        }
        return 'Starting your shell. It reads your profile first, so this takes a second.'
    }
    if (status === 'running') {
        return null
    }
    if (status === 'missing') {
        return 'Claude Code is not installed, or your shell cannot find it. Open a terminal and run claude --version.'
    }
    if (exit === null) {
        return null
    }
    return describeExit(program, exit)
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
    program: PaneProgram
}

export function TerminalPane({ crew, paneId, program }: TerminalPaneProps): JSX.Element {
    const hostRef = useRef<HTMLDivElement>(null)
    const [hasPrinted, setHasPrinted] = useState(false)
    const [exit, setExit] = useState<PaneExit | null>(null)
    const [problem, setProblem] = useState<string | null>(null)

    useEffect(() => {
        const host = hostRef.current
        if (host === null) {
            return
        }

        setHasPrinted(false)
        setExit(null)
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
                setHasPrinted(true)
            },
            onExit: (exitCode, exitSignal) => setExit({ code: exitCode, signal: exitSignal }),
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

    const status = readPaneStatus({
        program,
        hasPrinted,
        isRunning: exit === null,
        exitCode: exit === null ? null : exit.code,
    })
    const note = describeStatus(status, program, exit)
    const isDead = status === 'missing' || status === 'ended'

    return (
        <section className="pane">
            <div className={clsx('screen', isDead && 'dead')} ref={hostRef} />
            {note !== null && <p className={status === 'missing' ? 'problem' : 'note'}>{note}</p>}
            {problem !== null && <p className="problem">{problem}</p>}
        </section>
    )
}
