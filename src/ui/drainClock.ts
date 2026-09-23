import { PaneDrain } from '../bridge'

export interface DrainClockOptions {
    intervalMilliseconds: number
    drain: () => Promise<PaneDrain>
    onChunks: (chunks: string[]) => void
    onExit: (exitCode: number | null, exitSignal: number | null) => void
    onFailure: (error: unknown) => void
}

export function startDrainClock(options: DrainClockOptions): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false
    let hasReportedExit = false

    function stop(): void {
        stopped = true
        if (timer !== null) {
            clearTimeout(timer)
            timer = null
        }
    }

    async function tick(): Promise<void> {
        timer = null

        try {
            const result = await options.drain()

            // The teardown contract is absolute. If the caller stopped the clock
            // while this drain was in flight, they are tearing down the UI.
            // We drop the chunks and exit silently to prevent write-after-teardown.
            if (stopped) {
                return
            }

            if (result.chunks.length > 0) {
                options.onChunks(result.chunks)
            }

            if (!result.isRunning && !hasReportedExit) {
                options.onExit(result.exitCode, result.exitSignal)
                hasReportedExit = true
            }

            // A shell can exit before its last output reaches us.
            // Stopping the moment isRunning goes false would lose the shell's final line.
            // So we keep draining until a drain comes back empty.
            if (!result.isRunning && result.chunks.length === 0) {
                stop()
                return
            }

            timer = setTimeout(tick, options.intervalMilliseconds)
        } catch (error) {
            // Error Policy: Any error is fatal to the clock.
            // Whether drain() rejects (IPC failure) or onChunks throws (UI render crash),
            // we catch it, kill the poller, and notify the caller.
            if (!stopped) {
                stop()
                options.onFailure(error)
            }
        }
    }

    // Latency improvement: Kick off the first fetch immediately so the UI isn't blank
    // for a full interval. We use setTimeout(tick, 0) instead of calling tick()
    // directly so we yield to the call stack, guaranteeing the caller receives
    // the stop() function before the first tick executes.
    timer = setTimeout(tick, 0)

    return stop
}
