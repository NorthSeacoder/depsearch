#!/usr/bin/env node
const { mkdirSync } = require('node:fs')
const { execSync } = require('node:child_process')

mkdirSync('src/generated', { recursive: true })

execSync('vscode-ext-gen --output src/generated/meta.ts', { stdio: 'inherit' })
