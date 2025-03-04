import process from 'node:process'
import { defineConfig } from 'tsup'

const env = process.env.NODE_ENV
export default defineConfig({
  entry: [
    'src/index.ts',
  ],
  sourcemap: env === 'development',
  minify: env === 'production',
  watch: env === 'development',
  format: ['cjs'],
  shims: false,
  dts: false,
  target: 'es2022',
  external: [
    'vscode',
  ],
  noExternal: [],
})
