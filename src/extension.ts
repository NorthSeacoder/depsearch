import type { Uri } from 'vscode'
import type { SearchParams } from './types'
import { defineExtension, executeCommand, useCommands } from 'reactive-vscode'
import { window } from 'vscode'
import { WEBVIEW_VIEW_ID } from './constants'
import { displayName } from './generated/meta'
import { SvelteViewProvider } from './panel'
import { getRelativePath, logger } from './utils'
import DependencyParser from './utils/dependency-parser'
import { searchInFilesWithRipgrep } from './utils/search'

/**
 * Activate the DepSearch extension
 * Sets up the webview provider and registers commands
 */
export const { activate, deactivate } = defineExtension((context) => {
  executeCommand('setContext', 'depsearch.supportedExts', ['.js', '.ts', '.jsx', '.tsx'])

  const provider = new SvelteViewProvider(context.extensionUri)
  context.subscriptions.push(window.registerWebviewViewProvider(WEBVIEW_VIEW_ID, provider))

  // 创建依赖解析器
  const parser = new DependencyParser()

  useCommands({
    'depsearch.openWebview': (uri?: Uri) => {
      provider.show()

      if (uri) {
        provider.post({
          title: 'setEntryFile',
          entryFile: uri.fsPath,
        })
        provider.updateState({ entryFile: uri.fsPath })
      }
    },
    'depsearch.search': async (params: SearchParams) => {
      try {
        const { uri, query, isCaseSensitive = false, isWholeWord = false } = params

        if (!uri) {
          throw new Error('未提供文件 URI')
        }

        if (!query || query.trim() === '') {
          throw new Error('搜索查询不能为空')
        }

        const statusMessage = window.setStatusBarMessage(`正在搜索: ${query}`)

        logger.info('开始解析依赖', getRelativePath(uri))
        const root = await parser.parseDependencies(uri)
        const files = root.getFiles()

        logger.info('开始搜索', query, { isCaseSensitive, isWholeWord })
        const results = await searchInFilesWithRipgrep(files, query, { isCaseSensitive, isWholeWord }, uri)

        statusMessage.dispose()

        provider.post({
          title: 'importResults',
          importResults: results,
        })

        provider.updateState({ importResults: results })

        logger.info('搜索完成', `找到 ${results.length} 个结果`)
        return results
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : '搜索过程中发生错误'
        window.showErrorMessage(`依赖搜索失败: ${errorMessage}`)
        logger.error('搜索失败', error)

        provider.post({
          title: 'searchError',
          msg: errorMessage,
        })

        return []
      }
    },
  })

  logger.info(`${displayName} 扩展已激活`)
})
