import { describe, expect, it } from 'vitest'
import packageJson from '../package.json'

describe('basic checks', () => {
  it('supplies consistent configuration', () => {
    expect(packageJson.name).toBe('depsearch')
    expect(packageJson.scripts.build).toContain('pnpm')
  })
})
