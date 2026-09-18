import { FlowSignal, OutputQueue, OutputQueueCounters } from '../outputQueue'

describe('OutputQueue', () => {
    describe('push', () => {
        test.each<{
            name: string
            pauseAtCharacters: number
            dropAtCharacters: number
            pushes: string[]
            expectedFlow: FlowSignal[]
            expectedCounters: OutputQueueCounters
        }>([
            {
                name: 'stays quiet below the pause mark',
                pauseAtCharacters: 10,
                dropAtCharacters: 20,
                pushes: ['abc'],
                expectedFlow: [null],
                expectedCounters: {
                    queuedCharacters: 3,
                    peakQueuedCharacters: 3,
                    droppedChunks: 0,
                    droppedCharacters: 0,
                },
            },
            {
                name: 'pauses when the pause mark is reached exactly',
                pauseAtCharacters: 10,
                dropAtCharacters: 20,
                pushes: ['abcde', 'fghij'],
                expectedFlow: [null, 'pause'],
                expectedCounters: {
                    queuedCharacters: 10,
                    peakQueuedCharacters: 10,
                    droppedChunks: 0,
                    droppedCharacters: 0,
                },
            },
            {
                name: 'pauses once, not again on every later chunk',
                pauseAtCharacters: 10,
                dropAtCharacters: 20,
                pushes: ['abcdefghij', 'k', 'l'],
                expectedFlow: ['pause', null, null],
                expectedCounters: {
                    queuedCharacters: 12,
                    peakQueuedCharacters: 12,
                    droppedChunks: 0,
                    droppedCharacters: 0,
                },
            },
            {
                name: 'drops the oldest chunk once the drop mark is passed',
                pauseAtCharacters: 10,
                dropAtCharacters: 20,
                pushes: ['abcde', 'fghij', 'klmno', 'pqrst', 'u'],
                expectedFlow: [null, 'pause', null, null, null],
                expectedCounters: {
                    queuedCharacters: 16,
                    peakQueuedCharacters: 21,
                    droppedChunks: 1,
                    droppedCharacters: 5,
                },
            },
            {
                name: 'drops more than one chunk when a single push overshoots',
                pauseAtCharacters: 10,
                dropAtCharacters: 20,
                pushes: ['abcde', 'fghij', 'klmno', 'pqrstuvwxyz0'],
                expectedFlow: [null, 'pause', null, null],
                expectedCounters: {
                    queuedCharacters: 17,
                    peakQueuedCharacters: 27,
                    droppedChunks: 2,
                    droppedCharacters: 10,
                },
            },
            {
                name: 'drops a chunk bigger than the drop mark whole, never in half',
                pauseAtCharacters: 10,
                dropAtCharacters: 20,
                pushes: ['x'.repeat(25)],
                expectedFlow: [null],
                expectedCounters: {
                    queuedCharacters: 0,
                    peakQueuedCharacters: 25,
                    droppedChunks: 1,
                    droppedCharacters: 25,
                },
            },
        ])('$name', ({ pauseAtCharacters, dropAtCharacters, pushes, expectedFlow, expectedCounters }) => {
            const queue = new OutputQueue(pauseAtCharacters, dropAtCharacters)

            expect(pushes.map((chunk) => queue.push(chunk))).toEqual(expectedFlow)
            expect(queue.counters()).toEqual(expectedCounters)
        })
    })

    describe('drain', () => {
        test('returns every chunk in order and empties the queue', () => {
            const queue = new OutputQueue(10, 20)
            queue.push('abc')
            queue.push('de')

            expect(queue.drain()).toEqual(['abc', 'de'])
            expect(queue.drain()).toEqual([])
            expect(queue.counters().queuedCharacters).toBe(0)
        })

        test('clears the queue without clearing the peak or the dropped counters', () => {
            const queue = new OutputQueue(10, 20)
            queue.push('x'.repeat(25))
            queue.drain()
            queue.push('de')

            expect(queue.counters()).toEqual({
                queuedCharacters: 2,
                peakQueuedCharacters: 25,
                droppedChunks: 1,
                droppedCharacters: 25,
            })
        })
    })

    describe('afterDrain', () => {
        test('asks for a resume only when the queue had paused', () => {
            const queue = new OutputQueue(10, 20)
            queue.push('abcdefghij')

            expect(queue.afterDrain()).toBe('resume')
        })

        test('stays quiet when the queue never paused', () => {
            const queue = new OutputQueue(10, 20)
            queue.push('abc')

            expect(queue.afterDrain()).toBeNull()
        })

        test('stays quiet on a second call, so one pause gives one resume', () => {
            const queue = new OutputQueue(10, 20)
            queue.push('abcdefghij')
            queue.afterDrain()

            expect(queue.afterDrain()).toBeNull()
        })
    })
})
