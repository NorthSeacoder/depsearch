import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import {rgPath} from '@vscode/ripgrep';
import {exec} from 'child_process';
import {promisify} from 'util';
import {logger} from '.';

const execAsync = promisify(exec);
const existsAsync = promisify(fs.exists);

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

    // 检查 ripgrep 二进制文件是否存在
    const rgExists = await existsAsync(rgPath);
    logger.info(`ripgrep 二进制文件路径: ${rgPath}...`);
    if (!rgExists) {
        logger.warn(`ripgrep 二进制文件不存在: ${rgPath}，尝试手动安装...`);
        try {
            // 获取 @vscode/ripgrep 包的路径
            const rgpkgPath = path.dirname(path.dirname(rgPath));
            // 手动触发 postinstall 脚本
            await execAsync(`cd "${rgpkgPath}" && node ./lib/postinstall.js --force`);
            logger.info('ripgrep 二进制文件安装成功');
        } catch (error) {
            logger.info('安装 ripgrep 二进制文件失败,使用 node 搜索');
            // 如果安装失败，使用 Node.js 实现的搜索
            return await searchWithNodeJs(files, queryString, options, cwd);
        }
    }

    // 构造 ripgrep 命令
    const escapeShell = (cmd: string) => cmd.replace(/(["\s'$`\\])/g, '\\$1');
    const safeQuery = escapeShell(queryString);
    logger.info(`ripgrep 搜索命令: ${safeQuery}...`);
    // 处理文件路径 - 将相对路径转换为绝对路径
    const absoluteFiles = files.map((file) => {
        if (path.isAbsolute(file)) {
            return file;
        }
        return path.join(cwd, file);
    });

    // 使用绝对路径作为搜索目标
    const filesArgs = absoluteFiles.map((file) => `"${escapeShell(file)}"`).join(' ');

    const caseFlag = options.isCaseSensitive ? '' : '-i'; // 大小写敏感
    const wordFlag = options.isWholeWord ? '-w' : ''; // 全字匹配

    const execString = `"${rgPath}" --no-messages --vimgrep -H --column --line-number --color never ${caseFlag} ${wordFlag} -e "${safeQuery}" ${filesArgs}`;

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
        logger.info('Ripgrep search failed, falling back to Node.js implementation...');
        // 如果 ripgrep 搜索失败，使用 Node.js 实现的搜索
        return await searchWithNodeJs(files, queryString, options, cwd);
    }
}

// 使用 Node.js 实现的搜索
async function searchWithNodeJs(
    files: string[],
    queryString: string,
    options: {isCaseSensitive: boolean; isWholeWord: boolean},
    cwd: string
): Promise<SearchMatch[]> {
    const readFileAsync = promisify(fs.readFile);

    // 创建正则表达式
    let flags = options.isCaseSensitive ? 'g' : 'gi';
    let pattern = options.isWholeWord ? `\\b${escapeRegExp(queryString)}\\b` : escapeRegExp(queryString);
    const regex = new RegExp(pattern, flags);

    const results: SearchMatch[] = [];

    // 处理文件路径 - 将相对路径转换为绝对路径
    const absoluteFiles = files.map((file) => {
        if (path.isAbsolute(file)) {
            return file;
        }
        return path.join(cwd, file);
    });

    // 搜索每个文件
    for (const filePath of absoluteFiles) {
        try {
            // 检查文件是否存在
            const exists = await existsAsync(filePath);
            if (!exists) {
                logger.warn(`文件不存在: ${filePath}`);
                continue;
            }

            // 读取文件内容
            const content = await readFileAsync(filePath, 'utf-8');
            const lines = content.split('\n');

            // 搜索每一行
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                let match;

                // 重置正则表达式的 lastIndex
                regex.lastIndex = 0;

                while ((match = regex.exec(line)) !== null) {
                    results.push({
                        filePath,
                        lineNumber: i + 1, // 1-based 行号
                        column: match.index + 1, // 1-based 列号
                        matchText: line,
                        range: new vscode.Range(i, match.index, i, match.index + match[0].length)
                    });
                }
            }
        } catch (error) {
            logger.error(`搜索文件时出错 ${filePath}:`, error);
        }
    }

    return results;
}

// 转义正则表达式特殊字符
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$1');
}
