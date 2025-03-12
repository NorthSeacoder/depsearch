import {getDefaultLoggerPrefix, useLogger} from 'reactive-vscode';
import {displayName} from '../generated/meta';

export * from './vscode-utils';
// 创建带时间戳的日志记录器
export const logger = useLogger(displayName, {
    getPrefix: getDefaultLoggerPrefix
});
