import {workspace, Uri, SymbolKind, type DocumentSymbol} from 'vscode';
import path from 'path';
import fs from 'fs';
import { logger } from '.';
import depseeker from '@nsea/depseeker'
import { type DepSeeker } from '@nsea/depseeker';

export default class DependencyParser {
    private maxDepth: number = 5;
    private cache: Map<string, DepSeeker> = new Map();

    constructor(maxDepth: number = 5) {
        this.maxDepth = maxDepth;
    }

    async parseDependencies(uri: Uri, level: number = 0): Promise<DepSeeker> {
        const filePath = uri.fsPath;
        // 检查缓存
        if (this.cache.has(filePath)) {
            return this.cache.get(filePath)!;
        }
        const tsConfig = await this.findTsconfig(filePath);
        logger.info('tsConfig', tsConfig);
        // 解析 tsconfig.json

        const options = {
            includeNpm: false,
            fileExtensions: ['js', 'jsx', 'ts', 'tsx'],
            excludeRegExp: [/\.d\.ts$/, /node_modules/, /dist/, /build/, /coverage/],
            detectiveOptions: {
              ts: {
                skipTypeImports: true,
              },
            },
            tsConfig,
            baseDir: path.dirname(tsConfig)
          }
          const result = await depseeker(filePath, options)
        // 提取 import/require 语句
        logger.info('baseDir', path.dirname(tsConfig));
        logger.info('obj', JSON.stringify(result.obj()));
        logger.info('getFiles', result.getFiles());
        // 解析路径别名（基于 tsconfig.json）
        return result
    }

    async findTsconfig(filePath:string): Promise<string> {
        // 从当前文件向上查找 tsconfig.json
        let dir = path.dirname(filePath);
        while (dir !== '/') {
            const tsconfigPath = path.join(dir, 'tsconfig.json');
            if (fs.existsSync(tsconfigPath)) {
                return tsconfigPath;
            }
            dir = path.dirname(dir);
        }
        throw new Error('未找到 tsconfig.json');
    }
}
