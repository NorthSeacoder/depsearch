import type {Uri, TreeItem} from 'vscode';
import {window, commands, workspace} from 'vscode';
import {defineExtension, useCommands, executeCommand} from 'reactive-vscode';
import {displayName} from './generated/meta';
import {logger, getRelativePath} from './utils';
import DependencyParser from './utils/dependency-parser';
import {searchInFilesWithRipgrep,buildSearchMatchTree} from './utils/search';
import {SvelteViewProvider} from './panel';
import {WEBVIEW_VIEW_ID} from './constants';

/**
 * Activate the DepSearch extension
 * Sets up the webview provider and registers commands
 */
export const { activate, deactivate } = defineExtension((context) => {
  executeCommand('setContext', 'depsearch.supportedExts', ['.js', '.ts', '.jsx', '.tsx'])

<<<<<<< HEAD
  const provider = new SvelteViewProvider(context.extensionUri)
  context.subscriptions.push(window.registerWebviewViewProvider(WEBVIEW_VIEW_ID, provider))
=======
// 定义搜索参数接口
interface SearchParams {
    uri: Uri;
    query?: string;
    isCaseSensitive?: boolean;
    isWholeWord?: boolean;
    exclusions?: string;
}
>>>>>>> 343b724 (feat: loading 交互修复)

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

    useCommands({
        'depsearch.openWebview': (uri: Uri) => {
            // 显示 webview
            provider.show();

            // 如果有 URI，则将其作为入口文件传递给 webview
            if (uri) {
                const entryFile = uri.fsPath;
                logger.info('设置入口文件:', entryFile);
                provider.enqueueMessage({
                    title: 'setEntryFile',
                    entryFile
                });
            }
        },
        'depsearch.search': async (params: SearchParams) => {
            try {
                const {uri, query, isCaseSensitive = false, isWholeWord = false, exclusions} = params;
                logger.info('搜索参数:', JSON.stringify({params}));
                if (!uri) {
                    throw new Error('未提供文件 URI');
                }

                if (!query || query.trim() === '') {
                    throw new Error('搜索查询不能为空');
                }

                // 显示状态消息
                const statusMessage = window.setStatusBarMessage(`正在搜索: ${query}`);

                // 解析依赖
                logger.info('开始解析依赖', getRelativePath(uri));
                const root = await parser.parseDependencies(uri);
                const files = root.getFiles();
                
                // 执行搜索，添加进度回调
                logger.info('开始搜索', query, {isCaseSensitive, isWholeWord});
                
                // 创建进度回调函数
                const progressCallback = (current: number, total: number, status?: string) => {
                    provider.post({
                        title: 'searchProgress',
                        progress: {
                            current,
                            total,
                            status
                        }
                    });
                };
                
                // 初始化进度
                progressCallback(0, files.length, '初始化搜索...');
                
                const results = await searchInFilesWithRipgrep(
                    files, 
                    query, 
                    {isCaseSensitive, isWholeWord, exclusions}, 
                    uri,
                    progressCallback
                );
                
                logger.info('搜索到的结果:');
                const searchMatchTree = buildSearchMatchTree(results, root.obj(), uri);
                // 清除状态消息
                statusMessage.dispose();

                // 将结果发送到 webview
                provider.post({
                    title: 'importResults',
                    importResults: results,
                    treeResults: searchMatchTree
                });

                logger.info('搜索完成', `找到 ${results.length} 个结果`);
                return results;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : '搜索过程中发生错误';
                window.showErrorMessage(`依赖搜索失败: ${errorMessage}`);
                logger.error('搜索失败', error);

                // 通知 webview 搜索失败
                provider.post({
                    title: 'searchError',
                    msg: errorMessage
                });

                return [];
            }
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
