import type { SearchMatch, SearchOptions } from '../types'
import { exec } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { promisify } from 'node:util'
import { rgPath } from '@vscode/ripgrep'
import * as vscode from 'vscode'
import { logger } from '.'

const execAsync = promisify(exec);
const existsAsync = promisify(fs.exists);

interface SearchMatch {
    filePath: string;
    lineNumber: number;
    column: number;
    matchText: string;
    range: vscode.Range; // 用于跳转
}
interface SearchMatchTree {
    filePath: string;
    lineNumber: number;
    column: number;
    matchText: string;
    range: vscode.Range; // 用于跳转
    children: SearchMatchTree[];
}

// 用于获取和缓存有效的ripgrep路径
let cachedRgPath: string | null = null;
async function getValidRgPath(): Promise<string | null> {
    // 如果已经有缓存的有效路径，直接返回
    if (cachedRgPath) {
        return cachedRgPath;
    }

    // 首先检查@vscode/ripgrep提供的路径
    if (await existsAsync(rgPath)) {
        cachedRgPath = rgPath;
        return cachedRgPath;
    }

    // 尝试在扩展目录中查找rg
    const extensionDir = path.resolve(__dirname, '..');
    const candidatePaths = [
        // 扩展目录中的bin目录
        path.join(extensionDir, 'bin', 'rg'),
        // node_modules中的rg
        path.join(extensionDir, 'node_modules', '@vscode', 'ripgrep', 'bin', 'rg'),
        // 在PATH中查找rg
        'rg' 
    ];

    // 在macOS和Linux上，尝试使用which命令查找rg
    if (process.platform !== 'win32') {
        try {
            const { stdout } = await execAsync('which rg', { maxBuffer: 5 * 1024 * 1024 });
            if (stdout.trim()) {
                candidatePaths.push(stdout.trim());
            }
        } catch (error) {
            logger.info('which rg命令失败，跳过');
        }
    }

    // 检查每个候选路径
    for (const candidatePath of candidatePaths) {
        try {
            if (candidatePath === 'rg') {
                // 对于PATH中的rg，尝试运行版本命令验证
                await execAsync('rg --version', { maxBuffer: 5 * 1024 * 1024 });
                cachedRgPath = 'rg'; // 使用命令名称而不是路径
                return cachedRgPath;
            } else if (await existsAsync(candidatePath)) {
                // 验证找到的rg是否可执行
                await execAsync(`"${candidatePath}" --version`, { maxBuffer: 5 * 1024 * 1024 });
                cachedRgPath = candidatePath;
                return cachedRgPath;
            }
        } catch (error) {
            logger.info(`验证路径失败 ${candidatePath}: ${error}`);
            continue;
        }
    }

    // 尝试安装ripgrep
    try {
        // 尝试找到postinstall.js脚本
        let postinstallPath = null;
        const potentialPostinstallPaths = [
            path.join(path.dirname(path.dirname(rgPath)), 'lib', 'postinstall.js'),
            path.join(extensionDir, 'node_modules', '@vscode', 'ripgrep', 'lib', 'postinstall.js')
        ];

        for (const potentialPath of potentialPostinstallPaths) {
            if (fs.existsSync(potentialPath)) {
                postinstallPath = potentialPath;
                break;
            }
        }

        if (postinstallPath) {
            logger.info(`尝试通过postinstall脚本安装ripgrep: ${postinstallPath}`);
            await execAsync(`node "${postinstallPath}" --force`, { maxBuffer: 5 * 1024 * 1024 });
            
            // 安装后再次检查rgPath
            if (await existsAsync(rgPath)) {
                cachedRgPath = rgPath;
                return cachedRgPath;
            }
        }
    } catch (error) {
        logger.error(`安装ripgrep失败: ${error}`);
    }

    // 所有尝试都失败了
    return null;
}

export async function searchInFilesWithRipgrep(
    files: string[],
    queryString: string,
    options: {isCaseSensitive: boolean; isWholeWord: boolean; exclusions?: string},
    sourceUri: vscode.Uri // 必需参数，不再是可选的
): Promise<SearchMatch[]> {
  if (!files.length) {
    logger.warn('No files provided for search')
    return []
  }

  if (!queryString || !queryString.trim()) {
    logger.warn('Empty query string provided')
    return []
  }

  const cwd = getWorkingDirectory(sourceUri)
  const rgExists = await fileExists(rgPath)

  logger.info(`ripgrep binary path: ${rgPath}`)

  if (!rgExists) {
    logger.warn(`ripgrep binary not found: ${rgPath}, attempting manual installation...`)
    const installed = await tryInstallRipgrep()
    if (!installed) {
      logger.info('Using Node.js fallback for search')
      return await searchWithNodeJs(files, queryString, options, cwd)
    }
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

    // 获取有效的ripgrep路径
    const effectiveRgPath = await getValidRgPath();
    if (!effectiveRgPath) {
        logger.info('找不到有效的ripgrep路径，使用Node.js搜索');
        return await searchWithNodeJs(files, queryString, options, cwd);
    }
    
    logger.info(`使用ripgrep路径: ${effectiveRgPath}`);

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
    
    // 处理排除参数
    let excludeFlags = '';
    if (options.exclusions) {
        const exclusionPatterns = options.exclusions.split(',').map(pattern => pattern.trim());
        excludeFlags = exclusionPatterns.map(pattern => `--glob=!${escapeShell(pattern)}`).join(' ');
    }

    // 根据不同的路径格式构造命令
    let execString = '';
    if (effectiveRgPath === 'rg') {
        // 使用PATH中的rg
        execString = `rg --no-messages --vimgrep -H --column --line-number --color never ${caseFlag} ${wordFlag} ${excludeFlags} -e "${safeQuery}" ${filesArgs}`;
    } else {
        // 使用完整路径
        execString = `"${effectiveRgPath}" --no-messages --vimgrep -H --column --line-number --color never ${caseFlag} ${wordFlag} ${excludeFlags} -e "${safeQuery}" ${filesArgs}`;
    }

    try {
        const {stdout, stderr} = await execAsync(execString, {
            cwd,
            maxBuffer: 10 * 1024 * 1024 // 增加到10MB缓冲区，防止大型搜索结果溢出
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
        logger.info(`Ripgrep search failed, falling back to Node.js implementation...,${JSON.stringify(error)}`);
        // 如果 ripgrep 搜索失败，使用 Node.js 实现的搜索
        return await searchWithNodeJs(files, queryString, options, cwd);
    }
}

/**
 * Get the appropriate working directory for the search
 */
function getWorkingDirectory(sourceUri: vscode.Uri): string {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(sourceUri)
  return workspaceFolder ? workspaceFolder.uri.fsPath : path.dirname(sourceUri.fsPath)
}

/**
 * Attempt to install ripgrep binary
 */
async function tryInstallRipgrep(): Promise<boolean> {
  try {
    const rgpkgPath = path.dirname(path.dirname(rgPath))
    await execAsync(`cd "${rgpkgPath}" && node ./lib/postinstall.js --force`)
    logger.info('ripgrep binary installed successfully')
    return true
  }
  catch (error) {
    logger.error('Failed to install ripgrep binary:', error)
    return false
  }
}

/**
 * Search using ripgrep command-line tool
 */
async function searchWithRipgrep(
  files: string[],
  queryString: string,
  options: SearchOptions,
  cwd: string,
): Promise<SearchMatch[]> {
  const escapeShell = (cmd: string) => cmd.replace(/(["\s'$`\\])/g, '\\$1')
  const safeQuery = escapeShell(queryString)

  const absoluteFiles = files.map(file =>
    path.isAbsolute(file) ? file : path.join(cwd, file),
  )

  const filesArgs = absoluteFiles.map(file => `"${escapeShell(file)}"`).join(' ')
  const caseFlag = options.isCaseSensitive ? '' : '-i'
  const wordFlag = options.isWholeWord ? '-w' : ''

  const execString = `"${rgPath}" --no-messages --vimgrep -H --column --line-number --color never ${caseFlag} ${wordFlag} -e "${safeQuery}" ${filesArgs}`

  const { stdout, stderr } = await execAsync(execString, {
    cwd,
    maxBuffer: 1024 * 1024, // 1MB buffer
  })

  if (stderr) {
    logger.warn('Ripgrep stderr:', stderr)
  }

  return parseRipgrepOutput(stdout)
}

/**
 * Parse ripgrep output into SearchMatch array
 */
function parseRipgrepOutput(output: string): SearchMatch[] {
  return output
    .trim()
    .split('\n')
    .filter(line => line.length > 0)
    .map((line) => {
      const [filePath, lineNumber, column, ...matchParts] = line.split(':')
      const matchText = matchParts.join(':').trim()
      const lineNum = Number.parseInt(lineNumber, 10) - 1 // Convert to 0-based
      const colNum = Number.parseInt(column, 10) - 1 // Convert to 0-based

      return {
        filePath,
        lineNumber: lineNum + 1, // Return 1-based line number
        column: colNum + 1, // Return 1-based column number
        matchText,
        range: new vscode.Range(lineNum, colNum, lineNum, colNum + matchText.length),
      }
    })
}

/**
 * Search using pure Node.js implementation (fallback)
 */
async function searchWithNodeJs(
    files: string[],
    queryString: string,
    options: {isCaseSensitive: boolean; isWholeWord: boolean; exclusions?: string},
    cwd: string
): Promise<SearchMatch[]> {
    const readFileAsync = promisify(fs.readFile);
    logger.info('使用 Node.js 搜索', queryString);
    // 创建正则表达式
    let flags = options.isCaseSensitive ? 'g' : 'gi';
    let pattern = options.isWholeWord ? `\\b${escapeRegExp(queryString)}\\b` : escapeRegExp(queryString);
    const regex = new RegExp(pattern, flags);

  const absoluteFiles = files.map(file =>
    path.isAbsolute(file) ? file : path.join(cwd, file),
  )

    // 处理文件路径 - 将相对路径转换为绝对路径
    const absoluteFiles = files.map((file) => {
        if (path.isAbsolute(file)) {
            return file;
        }
        return path.join(cwd, file);
    });
    
    // 处理排除模式
    const exclusionPatterns: RegExp[] = [];
    if (options.exclusions) {
        const patterns = options.exclusions.split(',').map(pattern => pattern.trim());
        patterns.forEach(pattern => {
            // 将glob模式转换为正则表达式
            const regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
            exclusionPatterns.push(new RegExp(`^${regexPattern}$`));
        });
    }
    
    logger.info('搜索的文件:', absoluteFiles.length);
    // 搜索每个文件
    for (const filePath of absoluteFiles) {
        try {
            // 检查文件是否存在
            const exists = await existsAsync(filePath);
            if (!exists) {
                logger.warn(`文件不存在: ${filePath}`);
                continue;
            }
            
            // 检查文件是否应该被排除
            const relativePath = path.relative(cwd, filePath);
            if (exclusionPatterns.some(pattern => 
                pattern.test(relativePath) || pattern.test(path.basename(filePath))
            )) {
                logger.info(`文件被排除: ${filePath}`);
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
    }
    return results;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$1')
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  }
  catch {
    return false
  }
}

/**
 * 将搜索结果转换为树形结构
 * @param searchResults 搜索结果数组
 * @param dependencies 依赖关系对象
 * @returns 树形结构的搜索结果
 */
export function buildSearchMatchTree(
    searchResults: SearchMatch[],
    dependencies: Record<string, string[]>
): SearchMatchTree[] {
    // 按文件路径分组搜索结果
    const resultsByFile = new Map<string, SearchMatch[]>();
    searchResults.forEach(result => {
        // 遍历依赖对象的键，找到匹配的路径
        const matchedPath = Object.keys(dependencies).find(depPath => 
            result.filePath.endsWith(depPath)
        );
        
        if (matchedPath) {
            if (!resultsByFile.has(matchedPath)) {
                resultsByFile.set(matchedPath, []);
            }
            resultsByFile.get(matchedPath)!.push(result);
        }
    });

    logger.info('ResultsByFile:', Object.fromEntries(resultsByFile));

    // 构建反向依赖图（被谁依赖）
    const reverseDeps = new Map<string, string[]>();
    Object.entries(dependencies).forEach(([file, deps]) => {
        deps.forEach(dep => {
            if (!reverseDeps.has(dep)) {
                reverseDeps.set(dep, []);
            }
            reverseDeps.get(dep)!.push(file);
        });
    });

    logger.info('ReverseDeps:', Object.fromEntries(reverseDeps));

    // 递归构建树节点
    function buildTreeNode(filePath: string, visited = new Set<string>()): SearchMatchTree[] {
        logger.info('Building tree for:', filePath);
        if (visited.has(filePath)) {
            logger.info('Circular dependency detected:', filePath);
            return []; // 防止循环依赖
        }
        visited.add(filePath);

        const fileResults = resultsByFile.get(filePath) || [];
        const dependentFiles = reverseDeps.get(filePath) || [];
        
        logger.info('FileResults for', filePath, ':', fileResults.length, dependentFiles.length);

        const results = fileResults.map(result => {
            const children: SearchMatchTree[] = [];
            dependentFiles.forEach(depFile => {
                children.push(...buildTreeNode(depFile, new Set(visited)));
            });

            return {
                filePath: result.filePath,
                lineNumber: result.lineNumber,
                column: result.column,
                matchText: result.matchText,
                range: result.range,
                children
            };
        });

        logger.info('Results for', filePath, ':', results.length);
        return results;
    }

    // 从有搜索结果的文件开始构建树
    const tree: SearchMatchTree[] = [];
    for (const [filePath] of resultsByFile) {
        logger.info('Processing file with results:', filePath);
        tree.push(...buildTreeNode(filePath));
    }

    logger.info('Final tree size:', tree.length);
    return tree;
}
