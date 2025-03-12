
import { Uri, workspace } from 'vscode';
import path from 'path';
//根据 uri 获取在项目中的相对路径
export function getRelativePath(uri: Uri): string {
    const workspaceFolder = workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
        const relative = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
        // 处理空字符串并添加 ./ 前缀
        return relative === '' ? './' : `./${relative}`;
    }
    // 无工作区时返回绝对路径
    return uri.fsPath;
}