import { resolveLaunchArguments, resolveShell } from '../shell'

describe('resolveShell', () => {
    test.each<{
        name: string
        environment: { [key in string]?: string }
        platform: string
        expected: string
    }>([
        {
            name: 'returns SHELL on unix when set',
            environment: { SHELL: '/bin/zsh' },
            platform: 'darwin',
            expected: '/bin/zsh',
        },
        {
            name: 'falls back to /bin/sh on unix when SHELL is absent',
            environment: {},
            platform: 'darwin',
            expected: '/bin/sh',
        },
        {
            name: 'falls back to /bin/sh on unix when SHELL is empty',
            environment: { SHELL: '' },
            platform: 'linux',
            expected: '/bin/sh',
        },
        {
            name: 'returns COMSPEC on win32 when set',
            environment: { COMSPEC: 'C:\\pwsh.exe' },
            platform: 'win32',
            expected: 'C:\\pwsh.exe',
        },
        {
            name: 'ignores SHELL on win32 even when set',
            environment: { SHELL: '/bin/zsh' },
            platform: 'win32',
            expected: 'cmd.exe',
        },
    ])('$name', ({ environment, platform, expected }) => {
        expect(resolveShell(environment, platform)).toBe(expected)
    })
})

describe('resolveLaunchArguments', () => {
    test.each<{
        name: string
        programName: string
        platform: string
        expected: string[]
    }>([
        {
            name: 'runs the program through a login and interactive shell on macOS',
            programName: 'claude',
            platform: 'darwin',
            expected: ['-i', '-l', '-c', 'claude'],
        },
        {
            name: 'uses the same flags on linux',
            programName: 'claude',
            platform: 'linux',
            expected: ['-i', '-l', '-c', 'claude'],
        },
        {
            name: 'passes the program name through unchanged',
            programName: 'codex',
            platform: 'darwin',
            expected: ['-i', '-l', '-c', 'codex'],
        },
        {
            name: 'uses the cmd.exe flag on win32, where there is no login shell',
            programName: 'claude',
            platform: 'win32',
            expected: ['/c', 'claude'],
        },
    ])('$name', ({ programName, platform, expected }) => {
        expect(resolveLaunchArguments(programName, platform)).toEqual(expected)
    })
})
