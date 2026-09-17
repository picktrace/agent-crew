// oxlint-disable-next-line no-process-env
process.env.TZ = 'UTC'

// oxlint-disable-next-line import/no-default-export
export default {
    moduleNameMapper: {
        '\\.(css|svg)$': 'identity-obj-proxy',
    },
    testRegex: '(/__tests__/.*|(\\.|/))test\\.tsx?$',
    testPathIgnorePatterns: ['/node_modules/', '/out/'],
    transform: {
        '^.+\\.(t|j)sx?$': '@swc/jest',
    },
}
