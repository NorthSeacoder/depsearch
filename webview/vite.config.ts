import path from 'node:path'
import process from 'node:process'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import tsConfig from './tsconfig.json'

export default defineConfig({
  plugins: [svelte()],
  build: {
    lib: {
      name: 'view',
      entry: path.resolve(__dirname, 'src/main.ts'),
      fileName: () => 'index.js',
      formats: ['iife'],
    },
    outDir: 'dist',
    minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/main.ts'),
      output: {
        entryFileNames: 'index.js',
        assetFileNames: 'index.css',
      },
    },
    cssCodeSplit: false,
  },
  esbuild: {
    tsconfigRaw: tsConfig,
  },
})
