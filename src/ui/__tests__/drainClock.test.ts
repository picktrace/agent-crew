import { startDrainClock, DrainClockOptions } from '../drainClock'
import { PaneCounters, PaneDrain } from '../../bridge'

const emptyCounters: PaneCounters = {
    queuedCharacters: 0,
    peakQueuedCharacters: 0,
    droppedChunks: 0,
    droppedCharacters: 0,
}

describe('DrainClock', () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    function createMockOptions(): jest.Mocked<DrainClockOptions> {
        return {
            intervalMilliseconds: 16,
            drain: jest.fn().mockResolvedValue({
                chunks: [],
                isRunning: true,
                exitCode: null,
                exitSignal: null,
                counters: emptyCounters,
            }),
            onChunks: jest.fn(),
            onExit: jest.fn(),
            onFailure: jest.fn(),
        }
    }

    test('chunks reach onChunks', async () => {
        const options = createMockOptions()
        options.drain.mockResolvedValueOnce({
            chunks: ['hello', 'world'],
            isRunning: true,
            exitCode: null,
            exitSignal: null,
            counters: emptyCounters,
        })

        const stop = startDrainClock(options)

        // Instant start: advancing by 0 executes the first tick
        await jest.advanceTimersByTimeAsync(0)

        expect(options.onChunks).toHaveBeenCalledWith(['hello', 'world'])
        stop()
    })

    test('it drains once per interval while the shell runs', async () => {
        const options = createMockOptions()

        const stop = startDrainClock(options)

        // T=0 (drain 1), T=16 (drain 2), T=32 (drain 3), T=48 (drain 4), T=64 (drain 5)
        await jest.advanceTimersByTimeAsync(16 * 4)

        expect(options.drain).toHaveBeenCalledTimes(5)
        stop()
    })

    test('no drain happens after stop()', async () => {
        const options = createMockOptions()

        const stop = startDrainClock(options)
        await jest.advanceTimersByTimeAsync(0) // Trigger first drain

        stop()
        options.drain.mockClear()

        await jest.advanceTimersByTimeAsync(16 * 5)
        expect(options.drain).not.toHaveBeenCalled()
    })

    test('mount, stop, mount again gives one clock, not two', async () => {
        const options1 = createMockOptions()
        const options2 = createMockOptions()

        const stop1 = startDrainClock(options1)
        stop1() // React StrictMode instantly unmounts

        const stop2 = startDrainClock(options2) // And mounts again

        // T=0 (drain 1), T=16 (drain 2), T=32 (drain 3)
        await jest.advanceTimersByTimeAsync(16 * 2)

        // The first clock is dead, the second ticked 3 times
        expect(options1.drain).not.toHaveBeenCalled()
        expect(options2.drain).toHaveBeenCalledTimes(3)

        stop2()
    })

    test('a drain already in flight when it stopped is thrown away', async () => {
        const options = createMockOptions()

        let resolveDrain!: (value: PaneDrain) => void
        options.drain.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveDrain = resolve
                })
        )

        const stop = startDrainClock(options)

        // T=0: push time forward to trigger the tick, which hangs on the promise
        await jest.advanceTimersByTimeAsync(0)

        // Component unmounts while waiting
        stop()

        // The network/IPC finally replies with the late answer
        resolveDrain({
            chunks: ['late answer'],
            isRunning: true,
            exitCode: null,
            exitSignal: null,
            counters: emptyCounters,
        })

        // Flush microtasks so the await resolves
        await Promise.resolve()

        expect(options.onChunks).not.toHaveBeenCalled()
    })

    test('a failed drain reports once and stops, instead of retrying', async () => {
        const options = createMockOptions()
        const error = new Error('IPC disconnected')
        options.drain.mockRejectedValueOnce(error)

        const stop = startDrainClock(options)

        // Fails immediately on the first tick at T=0
        await jest.advanceTimersByTimeAsync(0)

        expect(options.onFailure).toHaveBeenCalledTimes(1)
        expect(options.onFailure).toHaveBeenCalledWith(error)

        // Should only have been called once before it stopped itself
        expect(options.drain).toHaveBeenCalledTimes(1)

        // Advancing time further proves it didn't retry
        await jest.advanceTimersByTimeAsync(16 * 5)
        expect(options.drain).toHaveBeenCalledTimes(1)

        stop()
    })

    test('the exit is reported once, after the last chunks are drawn', async () => {
        const options = createMockOptions()

        // Tick 1: Dead, but still has final chunks
        options.drain.mockResolvedValueOnce({
            chunks: ['last call'],
            isRunning: false,
            exitCode: 1,
            exitSignal: null,
            counters: emptyCounters,
        })

        // Tick 2: Dead and empty
        options.drain.mockResolvedValueOnce({
            chunks: [],
            isRunning: false,
            exitCode: 1,
            exitSignal: null,
            counters: emptyCounters,
        })

        const stop = startDrainClock(options)

        // Tick 1 (T=0)
        await jest.advanceTimersByTimeAsync(0)
        expect(options.onChunks).toHaveBeenCalledWith(['last call'])
        expect(options.onExit).toHaveBeenCalledWith(1, null)
        expect(options.onExit).toHaveBeenCalledTimes(1)

        // Tick 2 (T=16)
        await jest.advanceTimersByTimeAsync(16)
        expect(options.onChunks).toHaveBeenCalledTimes(1) // No new chunks
        expect(options.onExit).toHaveBeenCalledTimes(1) // Not called a second time

        // Tick 3 (T=32) - Should have stopped itself
        await jest.advanceTimersByTimeAsync(16)
        expect(options.drain).toHaveBeenCalledTimes(2) // Didn't poll a 3rd time

        stop()
    })

    test('a failed drain already in flight when it stopped is silent', async () => {
        const options = createMockOptions()

        let rejectDrain!: (error: unknown) => void
        options.drain.mockImplementation(
            () =>
                new Promise<PaneDrain>((resolve, reject) => {
                    resolveDrain = resolve
                    rejectDrain = reject
                })
        )

        const stop = startDrainClock(options)
        await jest.advanceTimersByTimeAsync(0)

        stop()
        rejectDrain(new Error('no pane with id'))
        await Promise.resolve()

        expect(options.onFailure).not.toHaveBeenCalled()
    })
})
