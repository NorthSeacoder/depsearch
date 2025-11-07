import { describe, expect, it } from 'vitest'
import { getRelativePath } from '../../src/utils/vscode-utils'

describe('vscode-utils', () => {
  describe('getRelativePath', () => {
    it('returns absolute path when no workspace folder', () => {
      const uri = { fsPath: '/home/user/project/src/index.ts' } as any
      const result = getRelativePath(uri)
      expect(result).toBe('/home/user/project/src/index.ts')
    })

    it('returns "./" for workspace root', async () => {
      const vscode = await import('vscode')
      const originalGetWorkspaceFolder = vscode.workspace.getWorkspaceFolder

      // Mock workspace folder
      vscode.workspace.getWorkspaceFolder = () => ({
        uri: { fsPath: '/home/user/project' },
      } as any)

      const uri = { fsPath: '/home/user/project' } as any
      const result = getRelativePath(uri)
      expect(result).toBe('./')

      // Restore
      vscode.workspace.getWorkspaceFolder = originalGetWorkspaceFolder
    })
  })
})
