import { PaneProgram, resolveLaunchArguments, resolveShell } from '../shell'

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
        program: PaneProgram
        platform: string
        expected: string[]
    }>([
        {
            name: 'gives the shell no arguments on macOS',
            program: 'shell',
            platform: 'darwin',
            expected: [],
        },
        {
            name: 'gives the shell no arguments on win32',
            program: 'shell',
            platform: 'win32',
            expected: [],
        },
        {
            name: 'runs the agent through a login and interactive shell on macOS',
            program: 'agent',
            platform: 'darwin',
            expected: ['-i', '-l', '-c', 'claude'],
        },
        {
            name: 'uses the same flags for the agent on linux',
            program: 'agent',
            platform: 'linux',
            expected: ['-i', '-l', '-c', 'claude'],
        },
        {
            name: 'uses the cmd.exe flag for the agent on win32, where there is no login shell',
            program: 'agent',
            platform: 'win32',
            expected: ['/c', 'claude'],
        },
    ])('$name', ({ program, platform, expected }) => {
        expect(resolveLaunchArguments(program, platform)).toEqual(expected)
    })
})
