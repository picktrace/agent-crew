import { PaneProgram } from './shell'

export type PaneStatus = 'starting' | 'running' | 'missing' | 'ended'

export interface PaneProgress {
    program: PaneProgram
    hasPrinted: boolean
    isRunning: boolean
    exitCode: number | null
}

const commandNotFoundExitCode = 127

export function readPaneStatus(progress: PaneProgress): PaneStatus {
    if (progress.isRunning) {
        return progress.hasPrinted ? 'running' : 'starting'
    }

    if (progress.program === 'agent' && progress.exitCode === commandNotFoundExitCode) {
        return 'missing'
    }

    return 'ended'
}
