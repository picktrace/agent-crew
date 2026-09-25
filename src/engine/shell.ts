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

// The six names Claude Code takes, plus ours for "pass no flag at all".
// We do not decide what an agent may do. This is how a person says it once.
export type AgentPermissionMode =
    | 'default'
    | 'acceptEdits'
    | 'auto'
    | 'bypassPermissions'
    | 'manual'
    | 'dontAsk'
    | 'plan'

const permissionModes: AgentPermissionMode[] = [
    'default',
    'acceptEdits',
    'auto',
    'bypassPermissions',
    'manual',
    'dontAsk',
    'plan',
]

export function readPermissionMode(environment: { [key in string]?: string }): AgentPermissionMode {
    const wanted = environment.CREW_PERMISSION_MODE
    if (wanted === undefined) {
        return 'default'
    }

    const found = permissionModes.find((mode) => mode === wanted)
    return found ?? 'default'
}

const agentCommandName = 'claude'

function agentCommand(mode: AgentPermissionMode): string {
    if (mode === 'default') {
        return agentCommandName
    }
    return `${agentCommandName} --permission-mode ${mode}`
}

export function resolveLaunchArguments(program: PaneProgram, platform: string, mode: AgentPermissionMode): string[] {
    if (program === 'shell') {
        return []
    }

    if (platform === 'win32') {
        return ['/c', agentCommand(mode)]
    }

    return ['-i', '-l', '-c', agentCommand(mode)]
}
