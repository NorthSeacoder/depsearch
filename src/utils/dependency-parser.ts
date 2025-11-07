import type { DepSeekerResult } from '@nsea/depseeker'
import type { DependencyParserOptions } from '../types'
import fs from 'node:fs/promises'
import path from 'node:path'
import depseeker from '@nsea/depseeker'
import { Uri, workspace } from 'vscode'
import { logger } from '.'

interface DependencyCacheEntry {
  result: DepSeekerResult
  timestamp: number
}

const DEFAULT_MAX_DEPTH = 5
const CACHE_TTL_MS = 5 * 60 * 1000 // Cache results for 5 minutes

export default class DependencyParser {
  private readonly maxDepth: number
  private readonly cache: Map<string, DependencyCacheEntry> = new Map()

  constructor(options?: DependencyParserOptions) {
    this.maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH
  }

  /**
   * Parse dependencies for a given file URI
   */
  async parseDependencies(uri: Uri, _level = 0): Promise<DepSeekerResult> {
    const filePath = uri.fsPath

    const cached = this.cache.get(filePath)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      logger.info('Using cached dependency graph', filePath)
      return cached.result
    }

    const tsConfig = await this.findTsconfig(filePath)

    const options: DependencyParserOptions = {
      includeNpm: false,
      fileExtensions: ['js', 'jsx', 'ts', 'tsx'],
      excludeRegExp: [/\.d\.ts$/, /node_modules/, /dist/, /build/, /coverage/],
      detectiveOptions: {
        ts: {
          skipTypeImports: true,
        },
      },
      tsConfig,
      baseDir: path.dirname(tsConfig),
    }

    logger.info('解析依赖 for', filePath)
    const result = await depseeker(filePath, options)

    this.cache.set(filePath, {
      result,
      timestamp: Date.now(),
    })

    return result
  }

  /**
   * Find the tsconfig.json file for a given path
   */
  async findTsconfig(filePath: string): Promise<string> {
    const workspaceFolder = workspace.getWorkspaceFolder(Uri.file(filePath))

    if (workspaceFolder) {
      const tsconfigPath = path.join(workspaceFolder.uri.fsPath, 'tsconfig.json')
      if (await this.fileExists(tsconfigPath)) {
        return tsconfigPath
      }
    }

    let dir = path.dirname(filePath)
    while (dir !== path.parse(dir).root) {
      const tsconfigPath = path.join(dir, 'tsconfig.json')
      if (await this.fileExists(tsconfigPath)) {
        return tsconfigPath
      }
      dir = path.dirname(dir)
    }

    throw new Error('未找到 tsconfig.json')
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    }
    catch {
      return false
    }
  }
}
