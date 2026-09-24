// agent-crew's local oxlint JS plugin. Loaded by oxlint via `jsPlugins` in
// .oxlintrc.json. Rules show up under the `agent-crew/` prefix.

const noElectronOutsideApp = require('./noElectronOutsideApp.cjs')

module.exports = {
    meta: {
        name: 'agent-crew',
    },
    rules: {
        'no-electron-outside-app': noElectronOutsideApp,
    },
}
