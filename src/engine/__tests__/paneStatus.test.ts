import { PaneProgress, PaneStatus, readPaneStatus } from '../paneStatus'

describe('readPaneStatus', () => {
    test.each<{ name: string; progress: PaneProgress; expected: PaneStatus }>([
        {
            name: 'says starting while an agent pane has printed nothing yet',
            progress: { program: 'agent', hasPrinted: false, isRunning: true, exitCode: null },
            expected: 'starting',
        },
        {
            name: 'says starting while a shell pane has printed nothing yet',
            progress: { program: 'shell', hasPrinted: false, isRunning: true, exitCode: null },
            expected: 'starting',
        },
        {
            name: 'says running once an agent pane has printed something',
            progress: { program: 'agent', hasPrinted: true, isRunning: true, exitCode: null },
            expected: 'running',
        },
        {
            name: 'says running once a shell pane has printed something',
            progress: { program: 'shell', hasPrinted: true, isRunning: true, exitCode: null },
            expected: 'running',
        },
        {
            name: 'says missing when an agent pane exits with 127',
            progress: { program: 'agent', hasPrinted: true, isRunning: false, exitCode: 127 },
            expected: 'missing',
        },
        {
            name: 'says missing when an agent pane exits with 127 before printing anything',
            progress: { program: 'agent', hasPrinted: false, isRunning: false, exitCode: 127 },
            expected: 'missing',
        },
        {
            name: 'says ended when a shell pane exits with 127, because the person typed the command',
            progress: { program: 'shell', hasPrinted: true, isRunning: false, exitCode: 127 },
            expected: 'ended',
        },
        {
            name: 'says ended when an agent pane exits with 0',
            progress: { program: 'agent', hasPrinted: true, isRunning: false, exitCode: 0 },
            expected: 'ended',
        },
        {
            name: 'says ended when an agent pane exits with 1',
            progress: { program: 'agent', hasPrinted: true, isRunning: false, exitCode: 1 },
            expected: 'ended',
        },
        {
            name: 'says ended when the pane stopped and no exit code came back',
            progress: { program: 'agent', hasPrinted: true, isRunning: false, exitCode: null },
            expected: 'ended',
        },
    ])('$name', ({ progress, expected }) => {
        expect(readPaneStatus(progress)).toBe(expected)
    })
})
