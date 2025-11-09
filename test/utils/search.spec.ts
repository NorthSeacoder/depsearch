import { afterEach, describe, expect, it, vi } from 'vitest'

const accessMock = vi.fn()
const readFileMock = vi.fn()
const execMock = vi.fn()

vi.mock('@vscode/ripgrep', () => ({
  rgPath: '/mock/path/to/rg',
}))

vi.mock('node:fs/promises', () => ({
  access: (...args: any[]) => accessMock(...args),
  readFile: (...args: any[]) => readFileMock(...args),
}))

vi.mock('node:child_process', () => ({
  exec: (...args: any[]) => execMock(...args),
}))

describe('searchInFilesWithRipgrep', () => {
  afterEach(() => {
    vi.clearAllMocks()
    accessMock.mockReset()
    readFileMock.mockReset()
    execMock.mockReset()
    accessMock.mockResolvedValue(undefined)
    readFileMock.mockResolvedValue('example content with Query term\nsecond line\n')
    execMock.mockImplementation((_cmd, _options, callback) => callback(null, { stdout: '', stderr: '' }))
  })

  it('returns empty array for empty file list', async () => {
    const { searchInFilesWithRipgrep } = await import('../../src/utils/search')
    const vscode = await import('vscode')
    const uri = vscode.Uri.file('/tmp/file.ts')

    const result = await searchInFilesWithRipgrep([], 'test', { isCaseSensitive: false, isWholeWord: false }, uri)

    expect(result).toEqual([])
    expect(accessMock).not.toHaveBeenCalled()
  })

  it('returns empty array for empty query', async () => {
    const { searchInFilesWithRipgrep } = await import('../../src/utils/search')
    const vscode = await import('vscode')
    const uri = vscode.Uri.file('/tmp/file.ts')

    const result = await searchInFilesWithRipgrep(['/tmp/file.ts'], '', { isCaseSensitive: false, isWholeWord: false }, uri)

    expect(result).toEqual([])
  })

  it('falls back to Node.js search when ripgrep is unavailable', async () => {
    const { searchInFilesWithRipgrep } = await import('../../src/utils/search')
    const vscode = await import('vscode')
    const uri = vscode.Uri.file('/tmp/file.ts')

    accessMock.mockImplementation(async (path: any) => {
      if (typeof path === 'string' && path.includes('/mock/path/to/rg')) {
        throw new Error('rg not found')
      }
      // allow access for searched file
      return undefined
    })

    readFileMock.mockResolvedValue('const value = "needle";\nexport default value;\nneedle again\n')
    execMock.mockImplementation((_cmd, _options, callback) => callback(new Error('installation failed')))

    const result = await searchInFilesWithRipgrep(['/tmp/file.ts'], 'needle', { isCaseSensitive: false, isWholeWord: false }, uri)

    expect(result.length).toBeGreaterThan(0)
    expect(result[0].filePath).toContain('/tmp/file.ts')
    expect(execMock).toHaveBeenCalled()
  })
})
