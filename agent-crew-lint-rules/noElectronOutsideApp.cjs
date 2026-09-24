const path = require('node:path')

const allowedFiles = ['src/app.ts', 'src/preload.ts']

function isAllowedFile(context) {
    const relative = path.relative(context.cwd, context.filename).split(path.sep).join('/')
    return allowedFiles.includes(relative)
}

function isElectron(value) {
    return typeof value === 'string' && (value === 'electron' || value.startsWith('electron/'))
}

module.exports = {
    createOnce(context) {
        function check(node, source) {
            if (isElectron(source) && !isAllowedFile(context)) {
                context.report({
                    node,
                    message: `Only ${allowedFiles.join(' and ')} may import electron.`,
                })
            }
        }

        return {
            ImportDeclaration: (node) => check(node, node.source.value),
            ImportExpression: (node) => check(node, node.source.value),
            ExportNamedDeclaration: (node) => check(node, node.source ? node.source.value : null),
            ExportAllDeclaration: (node) => check(node, node.source ? node.source.value : null),
            CallExpression: (node) => {
                if (node.callee.type !== 'Identifier' || node.callee.name !== 'require') {
                    return
                }
                const firstArgument = node.arguments[0]
                if (firstArgument && firstArgument.type === 'Literal') {
                    check(node, firstArgument.value)
                }
            },
        }
    },
}
