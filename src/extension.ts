import type {Uri, TreeItem} from 'vscode';
import  {window} from 'vscode';
import {defineExtension, useCommands, executeCommand} from 'reactive-vscode';
import {displayName} from './generated/meta';
import {logger, getRelativePath} from './utils';
import DependencyParser from './utils/dependency-parser';
import {searchInFilesWithRipgrep} from './utils/search';
import { SvelteViewProvider } from './panel';
import { WEBVIEW_VIEW_ID } from './constants';

// 定义树节点类型
interface DepsearchTreeNode {
    id: string;
    label: string;
    children?: DepsearchTreeNode[];
    treeItem: TreeItem;
}

export const {activate, deactivate} = defineExtension((context) => {
    executeCommand('setContext', 'depsearch.supportedExts', ['.js', '.ts', '.jsx', '.tsx']);

    const provider = new SvelteViewProvider(context.extensionUri);
    context.subscriptions.push(
      window.registerWebviewViewProvider(WEBVIEW_VIEW_ID, provider)
    );

    // 创建依赖解析器
    const parser = new DependencyParser();

    useCommands({
        'depsearch.search': async (uri: Uri) => {
            // 获取相对路径
            logger.info('search', getRelativePath(uri));
            // 解析依赖
            const root = await parser.parseDependencies(uri);
            const results = await searchInFilesWithRipgrep(
                root.getFiles(),
                'import',
                {isCaseSensitive: true, isWholeWord: true},
                uri
            );
            logger.info('search', JSON.stringify(results));
        }
    });

    logger.info(`${displayName} 扩展已激活`);
});

const res = [
    {
        filePath: '/Users/yqg/web/hateno/src/constant/field.ts',
        lineNumber: 1,
        column: 1,
        matchText: 'import OperatorComp from "@/components/layout/operator-comp";',
        range: [
            {line: 0, character: 0},
            {line: 0, character: 61}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/components/types/modal.ts',
        lineNumber: 1,
        column: 1,
        matchText: 'import { ReactNode } from "react";',
        range: [
            {line: 0, character: 0},
            {line: 0, character: 34}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/components/action-span/index.tsx',
        lineNumber: 1,
        column: 1,
        matchText: 'import { isTablet } from "@/constant";',
        range: [
            {line: 0, character: 0},
            {line: 0, character: 38}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/components/action-span/index.tsx',
        lineNumber: 2,
        column: 1,
        matchText: 'import { cn, isNilOrEmptyString } from "@/lib/utils";',
        range: [
            {line: 1, character: 0},
            {line: 1, character: 53}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/components/types/form.ts',
        lineNumber: 1,
        column: 1,
        matchText: 'import type { FileParams } from "@/lib/hooks";',
        range: [
            {line: 0, character: 0},
            {line: 0, character: 46}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/components/types/form.ts',
        lineNumber: 2,
        column: 1,
        matchText: 'import type { LucideProps } from "lucide-react";',
        range: [
            {line: 1, character: 0},
            {line: 1, character: 48}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/components/types/form.ts',
        lineNumber: 3,
        column: 1,
        matchText: 'import { ReactNode } from "react";',
        range: [
            {line: 2, character: 0},
            {line: 2, character: 34}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/components/types/form.ts',
        lineNumber: 4,
        column: 1,
        matchText: 'import { ControllerRenderProps, UseFormReturn } from "react-hook-form";',
        range: [
            {line: 3, character: 0},
            {line: 3, character: 71}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/lib/utils.ts',
        lineNumber: 1,
        column: 1,
        matchText: 'import { clsx, type ClassValue } from "clsx";',
        range: [
            {line: 0, character: 0},
            {line: 0, character: 45}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/lib/utils.ts',
        lineNumber: 2,
        column: 1,
        matchText: 'import { twMerge } from "tailwind-merge";',
        range: [
            {line: 1, character: 0},
            {line: 1, character: 41}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/lib/utils.ts',
        lineNumber: 3,
        column: 1,
        matchText: 'import { getLocale } from "umi";',
        range: [
            {line: 2, character: 0},
            {line: 2, character: 32}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/lib/utils.ts',
        lineNumber: 4,
        column: 4,
        matchText: '// import routerConfig from "@/constant/router-config";',
        range: [
            {line: 3, character: 3},
            {line: 3, character: 58}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/lib/utils.ts',
        lineNumber: 5,
        column: 1,
        matchText: 'import { Route } from "@/components/types";',
        range: [
            {line: 4, character: 0},
            {line: 4, character: 43}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/constant/theme-antd/index.ts',
        lineNumber: 1,
        column: 1,
        matchText: 'import type { ThemeConfig } from "antd";',
        range: [
            {line: 0, character: 0},
            {line: 0, character: 40}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/constant/theme-antd/index.ts',
        lineNumber: 3,
        column: 1,
        matchText: 'import Date from "./date";',
        range: [
            {line: 2, character: 0},
            {line: 2, character: 26}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/constant/theme-antd/index.ts',
        lineNumber: 4,
        column: 1,
        matchText: 'import Token from "./token";',
        range: [
            {line: 3, character: 0},
            {line: 3, character: 28}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/constant/theme-antd/index.ts',
        lineNumber: 5,
        column: 1,
        matchText: 'import Tabs from "./tabs";',
        range: [
            {line: 4, character: 0},
            {line: 4, character: 26}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/constant/theme-antd/index.ts',
        lineNumber: 6,
        column: 1,
        matchText: 'import Tag from "./tag";',
        range: [
            {line: 5, character: 0},
            {line: 5, character: 24}
        ]
    },
    {
        filePath: '/Users/yqg/web/hateno/src/constant/theme-antd/index.ts',
        lineNumber: 7,
        column: 1,
        matchText: 'import Segmented from "./segmented";',
        range: [
            {line: 6, character: 0},
            {line: 6, character: 36}
        ]
    }
];
