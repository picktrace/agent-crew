import { TerminalSession } from '../terminalSession'
import { Disposable, TerminalProcess } from '../terminalRuntime'
import { OutputQueue } from '../outputQueue'

class FakeProcess implements TerminalProcess {
    write = jest.fn()
    resize = jest.fn()
    pause = jest.fn()
    resume = jest.fn()
    kill = jest.fn()

    dataCallback: ((chunk: string) => void) | undefined
    exitCallback: ((code: number, signal: number | null) => void) | undefined

    dataDisposed = false
    exitDisposed = false

    onData(listen: (chunk: string) => void): Disposable {
        this.dataCallback = listen
        return {
            dispose: () => {
                this.dataDisposed = true
            },
        }
    }

    onExit(listen: (code: number, signal: number | null) => void): Disposable {
        this.exitCallback = listen
        return {
            dispose: () => {
                this.exitDisposed = true
            },
        }
    }
}

describe('TerminalSession', () => {
    test('what onData delivers reaches the queue', () => {
        const fakeProcess = new FakeProcess()
        const queue = new OutputQueue(100, 200)
        const session = new TerminalSession(fakeProcess, queue)

        if (fakeProcess.dataCallback) {
            fakeProcess.dataCallback('chunk 1')
            fakeProcess.dataCallback('chunk 2')
        }

        expect(session.drain()).toEqual(['chunk 1', 'chunk 2'])
    })

    test('a "pause" signal calls process.pause() exactly once', () => {
        const fakeProcess = new FakeProcess()
        const queue = new OutputQueue(10, 20)
        const session = new TerminalSession(fakeProcess, queue)

        if (fakeProcess.dataCallback) {
            // 12 characters, past the pause mark at 10 but under the drop mark at 20
            fakeProcess.dataCallback('hello world!')
        }

        expect(session.isRunning).toBe(true)
        expect(fakeProcess.pause).toHaveBeenCalledTimes(1)
    })

    test('a drain that clears the pause calls process.resume() exactly once', () => {
        const fakeProcess = new FakeProcess()
        const queue = new OutputQueue(10, 20)
        const session = new TerminalSession(fakeProcess, queue)

        if (fakeProcess.dataCallback) {
            fakeProcess.dataCallback('hello world!')
        }

        session.drain()

        expect(fakeProcess.resume).toHaveBeenCalledTimes(1)
    })

    test('onExit sets a dead state, and keeps exitCode and exitSignal', () => {
        const fakeProcess = new FakeProcess()
        const session = new TerminalSession(fakeProcess, new OutputQueue(100, 200))

        if (fakeProcess.exitCallback) {
            fakeProcess.exitCallback(1, 9)
        }

        expect(session.isRunning).toBe(false)
        expect(session.exitCode).toBe(1)
        expect(session.exitSignal).toBe(9)
    })

    test('drain() still returns what was queued, after exit', () => {
        const fakeProcess = new FakeProcess()
        const session = new TerminalSession(fakeProcess, new OutputQueue(100, 200))

        if (fakeProcess.dataCallback) {
            fakeProcess.dataCallback('final crash logs')
        }

        if (fakeProcess.exitCallback) {
            fakeProcess.exitCallback(1, null)
        }

        expect(session.drain()).toEqual(['final crash logs'])
    })

    test('touches nothing on the process after it has exited', () => {
        const fakeProcess = new FakeProcess()
        const session = new TerminalSession(fakeProcess, new OutputQueue(100, 200))

        if (fakeProcess.exitCallback) {
            fakeProcess.exitCallback(0, null)
        }

        session.write('data')
        session.resize(100, 30)

        expect(fakeProcess.write).not.toHaveBeenCalled()
        expect(fakeProcess.resize).not.toHaveBeenCalled()
    })

    test('resume() is never called after exit', () => {
        const fakeProcess = new FakeProcess()
        const queue = new OutputQueue(10, 20)
        const session = new TerminalSession(fakeProcess, queue)

        if (fakeProcess.dataCallback) {
            fakeProcess.dataCallback('hello world!')
        }

        if (fakeProcess.exitCallback) {
            fakeProcess.exitCallback(0, null)
        }

        session.drain()

        expect(fakeProcess.resume).not.toHaveBeenCalled()
    })

    test('close() disposes both and kills once, and a second close() is safe', () => {
        const fakeProcess = new FakeProcess()
        const session = new TerminalSession(fakeProcess, new OutputQueue(100, 200))

        session.close()

        expect(fakeProcess.dataDisposed).toBe(true)
        expect(fakeProcess.exitDisposed).toBe(true)
        expect(fakeProcess.kill).toHaveBeenCalledTimes(1)

        session.close()

        expect(fakeProcess.kill).toHaveBeenCalledTimes(1)
        expect(session.isRunning).toBe(false)

        session.write('data')
        expect(fakeProcess.write).not.toHaveBeenCalled()
    })

    test('close() on an already dead process does not call kill()', () => {
        const fakeProcess = new FakeProcess()
        const session = new TerminalSession(fakeProcess, new OutputQueue(100, 200))

        if (fakeProcess.exitCallback) {
            fakeProcess.exitCallback(0, null)
        }

        expect(session.isRunning).toBe(false)

        session.close()

        expect(fakeProcess.kill).not.toHaveBeenCalled()
        expect(fakeProcess.dataDisposed).toBe(true)
        expect(fakeProcess.exitDisposed).toBe(true)
    })
})
