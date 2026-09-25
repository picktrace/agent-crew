import { ClaudeConfig, isTrustEnabled, trustFolder } from '../trust'

describe('isTrustEnabled', () => {
    test.each<{ name: string; environment: { [key in string]?: string }; expected: boolean }>([
        { name: 'is on when nothing is set', environment: {}, expected: true },
        { name: 'is off when CREW_TRUST is exactly 0', environment: { CREW_TRUST: '0' }, expected: false },
        { name: 'is on for any other value', environment: { CREW_TRUST: 'no' }, expected: true },
        { name: 'is on when the value is empty', environment: { CREW_TRUST: '' }, expected: true },
    ])('$name', ({ environment, expected }) => {
        expect(isTrustEnabled(environment)).toBe(expected)
    })
})

describe('trustFolder', () => {
    test('marks a folder Claude Code has never seen', () => {
        const outcome = trustFolder({}, '/Users/me/code/web-api')

        expect(outcome.changed).toBe(true)
        expect(outcome.config.projects?.['/Users/me/code/web-api']?.hasTrustDialogAccepted).toBe(true)
    })

    test('changes nothing when the folder is already trusted', () => {
        const config: ClaudeConfig = { projects: { '/a': { hasTrustDialogAccepted: true } } }
        const outcome = trustFolder(config, '/a')

        expect(outcome.changed).toBe(false)
        expect(outcome.config).toBe(config)
    })

    test('keeps every other field in the project it touches', () => {
        const config: ClaudeConfig = { projects: { '/a': { allowedTools: ['Bash'], exampleFiles: ['x.ts'] } } }
        const outcome = trustFolder(config, '/a')

        expect(outcome.config.projects?.['/a']).toEqual({
            allowedTools: ['Bash'],
            exampleFiles: ['x.ts'],
            hasTrustDialogAccepted: true,
        })
    })

    test('keeps every other project and every top level key', () => {
        const config: ClaudeConfig = {
            numStartups: 412,
            projects: { '/other': { hasTrustDialogAccepted: true } },
        }
        const outcome = trustFolder(config, '/a')

        expect(outcome.config.numStartups).toBe(412)
        expect(outcome.config.projects?.['/other']?.hasTrustDialogAccepted).toBe(true)
    })

    test('does not change the config it was given', () => {
        const config: ClaudeConfig = { projects: {} }
        trustFolder(config, '/a')

        expect(config.projects).toEqual({})
    })
})
