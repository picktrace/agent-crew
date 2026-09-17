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
