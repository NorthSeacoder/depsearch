import * as path from 'path';
import * as vscode from 'vscode';
import {rgPath} from '@vscode/ripgrep';
import {exec} from 'child_process';
import {promisify} from 'util';
import {logger} from '.';

const execAsync = promisify(exec);

interface SearchMatch {
    filePath: string;
    lineNumber: number;
    column: number;
    matchText: string;
    range: vscode.Range; // 用于跳转
}

export async function searchInFilesWithRipgrep(
    files: string[],
    queryString: string,
    options: {isCaseSensitive: boolean; isWholeWord: boolean},
    sourceUri: vscode.Uri // 必需参数，不再是可选的
): Promise<SearchMatch[]> {
    if (!files.length) {
        return [];
    }

    // 获取工作区根目录
    let cwd: string;
    
    // 尝试获取 URI 所属的工作区
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(sourceUri);
    if (workspaceFolder) {
        // 如果 URI 属于工作区，使用工作区路径
        cwd = workspaceFolder.uri.fsPath;
    } else {
        // 如果 URI 不属于任何工作区，使用其所在目录作为工作目录
        cwd = path.dirname(sourceUri.fsPath);
    }

    // 构造 ripgrep 命令
    const escapeShell = (cmd: string) => cmd.replace(/(["\s'$`\\])/g, '\\$1');
    const safeQuery = escapeShell(queryString);
    
    // 处理文件路径 - 将相对路径转换为绝对路径
    const absoluteFiles = files.map(file => {
        if (path.isAbsolute(file)) {
            return file;
        }
        return path.join(cwd, file);
    });
    
    // 使用绝对路径作为搜索目标
    const filesArgs = absoluteFiles.map(file => `"${escapeShell(file)}"`).join(' ');
    
    const caseFlag = options.isCaseSensitive ? '' : '-i'; // 大小写敏感
    const wordFlag = options.isWholeWord ? '-w' : ''; // 全字匹配
    
    const execString = `${rgPath} --no-messages --vimgrep -H --column --line-number --color never ${caseFlag} ${wordFlag} -e "${safeQuery}" ${filesArgs}`;
    
    try {
        const {stdout, stderr} = await execAsync(execString, {
            cwd,
            maxBuffer: 1024 * 1024 // 1MB 缓冲区，防止溢出
        });

        if (stderr) {
            logger.error('Ripgrep stderr:', stderr);
        }

        // 解析 ripgrep 输出（格式：file:line:column:match）
        const results = stdout
            .trim()
            .split('\n')
            .filter((line) => line)
            .map((line) => {
                const [filePath, lineNumber, column, ...matchParts] = line.split(':');
                const matchText = matchParts.join(':').trim();
                const lineNum = parseInt(lineNumber, 10) - 1; // 转换为 0-based
                const colNum = parseInt(column, 10) - 1; // 转换为 0-based
                return {
                    filePath,
                    lineNumber: lineNum + 1, // 返回 1-based 行号
                    column: colNum + 1, // 返回 1-based 列号
                    matchText,
                    range: new vscode.Range(lineNum, colNum, lineNum, colNum + matchText.length)
                };
            });

        return results;
    } catch (error) {
        logger.error('Ripgrep search failed:', error);
        return [];
    }
}
