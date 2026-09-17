import { resolveShell } from '../shell'

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
