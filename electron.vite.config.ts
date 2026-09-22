import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'node:path'

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: { outDir: 'out/main', rollupOptions: { input: resolve('src/app.ts') } },
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            outDir: 'out/preload',
            rollupOptions: {
                input: resolve('src/preload.ts'),
                output: { format: 'cjs', entryFileNames: '[name].cjs' },
            },
        },
    },
    renderer: {
        root: 'src/ui',
        plugins: [react()],
        build: { outDir: 'out/renderer', rollupOptions: { input: resolve('src/ui/index.html') } },
    },
})
