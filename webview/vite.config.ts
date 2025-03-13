// webview/vite.config.ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

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
  },
  esbuild: {
    tsconfigRaw: require('./tsconfig.json'),
  },
});