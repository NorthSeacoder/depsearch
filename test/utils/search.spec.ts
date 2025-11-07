import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@vscode/ripgrep', () => ({
  rgPath: '/mock/path/to/rg',
}))

vi.mock('node:fs/promises', () => ({
  __esModule: true,
  default: {
    access: vi.fn(async () => undefined),
    readFile: vi.fn(async () => 'example content with Query term\nsecond line\n'),
  },
  access: vi.fn(async () => undefined),
  readFile: vi.fn(async () => 'example content with Query term\nsecond line\n'),
}))

vi.mock('node:child_process', () => ({
  exec: vi.fn((cmd, options, callback) => {
    callback(null, { stdout: '', stderr: '' })
  }),
}))

describe('searchInFilesWithRipgrep', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array for empty files', async () => {
    const { searchInFilesWithRipgrep } = await import('../../src/utils/search')
    const vscode = await import('vscode')
    const uri = vscode.Uri.file('/tmp/file.ts')
    const result = await searchInFilesWithRipgrep([], 'test', { isCaseSensitive: false, isWholeWord: false }, uri)
    expect(result).toEqual([])
  })

  it('returns empty array for empty query', async () => {
    const { searchInFilesWithRipgrep } = await import('../../src/utils/search')
    const vscode = await import('vscode')
    const uri = vscode.Uri.file('/tmp/file.ts')
    const result = await searchInFilesWithRipgrep(['/tmp/file.ts'], '', { isCaseSensitive: false, isWholeWord: false }, uri)
    expect(result).toEqual([])
  })
})
