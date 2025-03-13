import {getDefaultLoggerPrefix, useLogger} from 'reactive-vscode';
import {displayName} from '../generated/meta';
import {Webview, Uri} from 'vscode';
import * as crypto from 'crypto';
export * from './vscode-utils';
// 创建带时间戳的日志记录器
export const logger = useLogger(displayName, {
    getPrefix: getDefaultLoggerPrefix
});

export function getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
    return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}

export function getNonce() {
    return crypto.randomUUID().replace(/-/g, ''); // 使用加密安全的随机数
}
