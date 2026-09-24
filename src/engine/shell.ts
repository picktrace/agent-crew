export function resolveShell(environment: { [key in string]?: string }, platform: string): string {
    if (platform === 'win32') {
        const comspec = environment.COMSPEC
        if (comspec) {
            return comspec
        }
        return 'cmd.exe'
    }

    return environment.SHELL || '/bin/sh'
}

export type PaneProgram = 'shell' | 'agent'

const agentCommandName = 'claude'

export function resolveLaunchArguments(program: PaneProgram, platform: string): string[] {
    if (program === 'shell') {
        return []
    }

    if (platform === 'win32') {
        return ['/c', agentCommandName]
    }

    return ['-i', '-l', '-c', agentCommandName]
}
