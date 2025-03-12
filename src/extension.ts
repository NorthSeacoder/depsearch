import type {Uri, ExtensionContext, TreeItem} from 'vscode';
import {defineExtension, useCommands, executeCommand} from 'reactive-vscode';
import {displayName} from './generated/meta';
import {logger,getRelativePath} from './utils';
import DependencyParser from './utils/dependency-parser';
import { log } from 'console';
// 定义树节点类型
interface DepsearchTreeNode {
    id: string;
    label: string;
    children?: DepsearchTreeNode[];
    treeItem: TreeItem;
}

export const {activate, deactivate} = defineExtension(() => {
  executeCommand('setContext', 'depsearch.supportedExts', ['.js', '.ts', '.jsx', '.tsx']);
    // 创建依赖解析器
    const parser = new DependencyParser();

    useCommands({
        'depsearch.search':async (uri: Uri) => {
          // 获取相对路径
          logger.info('search',getRelativePath(uri));
            // 解析依赖
            const root = await parser.parseDependencies(uri);
            logger.info('search',JSON.stringify(root));
        }
    });

    logger.info(`${displayName} 扩展已激活`);
});
