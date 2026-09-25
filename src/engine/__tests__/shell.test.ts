import { AgentPermissionMode, PaneProgram, readPermissionMode, resolveLaunchArguments, resolveShell } from '../shell'

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

describe('readPermissionMode', () => {
    test.each<{ name: string; environment: { [key in string]?: string }; expected: AgentPermissionMode }>([
        { name: 'passes no flag when nothing is set', environment: {}, expected: 'default' },
        {
            name: 'takes a mode Claude Code knows',
            environment: { CREW_PERMISSION_MODE: 'bypassPermissions' },
            expected: 'bypassPermissions',
        },
        {
            name: 'takes every other mode Claude Code knows',
            environment: { CREW_PERMISSION_MODE: 'acceptEdits' },
            expected: 'acceptEdits',
        },
        {
            name: 'falls back to no flag for a name Claude Code does not know',
            environment: { CREW_PERMISSION_MODE: 'yolo' },
            expected: 'default',
        },
        {
            name: 'falls back to no flag for an empty value',
            environment: { CREW_PERMISSION_MODE: '' },
            expected: 'default',
        },
    ])('$name', ({ environment, expected }) => {
        expect(readPermissionMode(environment)).toBe(expected)
    })
})

describe('resolveLaunchArguments', () => {
    test.each<{
        name: string
        program: PaneProgram
        platform: string
        mode: AgentPermissionMode
        expected: string[]
    }>([
        {
            name: 'gives the shell no arguments on macOS',
            program: 'shell',
            platform: 'darwin',
            mode: 'default',
            expected: [],
        },
        {
            name: 'gives the shell no arguments even when a mode is set',
            program: 'shell',
            platform: 'darwin',
            mode: 'bypassPermissions',
            expected: [],
        },
        {
            name: 'gives the shell no arguments on win32',
            program: 'shell',
            platform: 'win32',
            mode: 'default',
            expected: [],
        },
        {
            name: 'runs the agent through a login and interactive shell on macOS',
            program: 'agent',
            platform: 'darwin',
            mode: 'default',
            expected: ['-i', '-l', '-c', 'claude'],
        },
        {
            name: 'uses the same flags for the agent on linux',
            program: 'agent',
            platform: 'linux',
            mode: 'default',
            expected: ['-i', '-l', '-c', 'claude'],
        },
        {
            name: 'adds the permission mode flag when one is chosen',
            program: 'agent',
            platform: 'darwin',
            mode: 'acceptEdits',
            expected: ['-i', '-l', '-c', 'claude --permission-mode acceptEdits'],
        },
        {
            name: 'adds the flag on win32 too',
            program: 'agent',
            platform: 'win32',
            mode: 'plan',
            expected: ['/c', 'claude --permission-mode plan'],
        },
        {
            name: 'uses the cmd.exe flag for the agent on win32, where there is no login shell',
            program: 'agent',
            platform: 'win32',
            mode: 'default',
            expected: ['/c', 'claude'],
        },
    ])('$name', ({ program, platform, mode, expected }) => {
        expect(resolveLaunchArguments(program, platform, mode)).toEqual(expected)
    })
})
