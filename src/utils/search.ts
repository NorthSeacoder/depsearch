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
    sourceUri: vscode.Uri,
    progressCallback?: (current: number, total: number, status?: string) => void
): Promise<SearchMatch[]> {
    if (!files.length) return [];

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
        if (progressCallback) progressCallback(0, files.length, '使用Node.js搜索');
        return await searchWithNodeJs(files, queryString, options, cwd, progressCallback);
    }
    
    logger.info(`使用ripgrep路径: ${effectiveRgPath}`);

    // 处理文件路径 - 将相对路径转换为绝对路径
    const absoluteFiles = files.map((file) => {
        if (path.isAbsolute(file)) {
            return file;
        }
        return path.join(cwd, file);
    });
    
    // 将文件列表分批，避免命令行过长
    const batchSize = 30;
    const batches: string[][] = [];
    for (let i = 0; i < absoluteFiles.length; i += batchSize) {
        batches.push(absoluteFiles.slice(i, i + batchSize));
    }
    
    logger.info(`将${absoluteFiles.length}个文件分为${batches.length}批处理，每批${batchSize}个文件`);
    
    // 收集所有批次的结果
    const allResults: SearchMatch[] = [];
    const processedFiles = new Set<string>();

    for (let i = 0; i < batches.length; i++) {
        // 只处理未处理过的文件
        const batchFiles = batches[i].filter(f => !processedFiles.has(f));
        if (batchFiles.length === 0) continue;

        const processingStatus = `搜索批次 ${i+1}/${batches.length}`;
        logger.info(`开始${processingStatus}，包含${batchFiles.length}个文件`);
        
        // 更新进度
        if (progressCallback) {
            const currentProgress = i * batchSize;
            progressCallback(
                currentProgress, 
                absoluteFiles.length, 
                processingStatus
            );
        }
        
        try {
            // 设置全局批次超时，确保即使子进程卡住也能继续
            const batchTimeoutMs = 200000; // 20秒整体超时
            let batchTimedOut = false;
            
            const timeoutPromise = new Promise<SearchMatch[]>(resolve => {
                setTimeout(() => {
                    batchTimedOut = true;
                    logger.warn(`批次 ${i+1}/${batches.length} 整体超时(${batchTimeoutMs/1000}秒)，跳过剩余文件`);
                    resolve([]);
                }, batchTimeoutMs);
            });
            
            // 将搜索操作与超时竞争
            const batchResults = await Promise.race([
                searchBatchWithRipgrep(batchFiles, queryString, options, cwd, effectiveRgPath),
                timeoutPromise
            ]);
            
            if (!batchTimedOut) {
                allResults.push(...batchResults);
                // 标记本批次所有文件为已处理
                batchFiles.forEach(f => processedFiles.add(f));
                logger.info(`完成批次 ${i+1}/${batches.length}，找到 ${batchResults.length} 个结果`);
            }
        } catch (error) {
            logger.error(`批次 ${i+1}/${batches.length} 处理失败: ${error}`);
            // 继续处理下一批，不中断整个搜索
        }
    }
    
    // 全局去重
    const uniqueResults = Array.from(new Map(
        allResults.map(r => [`${r.filePath}:${r.lineNumber}:${r.column}`, r])
    ).values());

    // 完成进度
    if (progressCallback) {
        progressCallback(absoluteFiles.length, absoluteFiles.length, '搜索完成');
    }
    
    return uniqueResults;
}

// 搜索单批文件的辅助函数 - 确保有明确的超时处理
async function searchBatchWithRipgrep(
    batchFiles: string[],
    queryString: string,
    options: {isCaseSensitive: boolean; isWholeWord: boolean; exclusions?: string},
    cwd: string,
    effectiveRgPath: string
): Promise<SearchMatch[]> {
    // 构造 ripgrep 命令
    const escapeShell = (cmd: string) => cmd.replace(/(["\s'$`\\])/g, '\\$1');
    const safeQuery = escapeShell(queryString);

    // 使用绝对路径作为搜索目标，但限制命令长度
    const filesArgs = batchFiles.map((file) => `"${escapeShell(file)}"`).join(' ');

    // 修复参数标记
    const caseFlag = options.isCaseSensitive ? '' : '--ignore-case'; // 大小写敏感
    const wordFlag = options.isWholeWord ? '--word-regexp' : ''; // 全字匹配
    
    // 处理排除参数
    let excludeFlags = '';
    if (options.exclusions && options.exclusions.trim()) {
        const exclusionPatterns = options.exclusions.split(',').map(pattern => pattern.trim()).filter(pattern => pattern);
        
        // 检查排除模式与要搜索的文件是否存在冲突
        const hasConflict = exclusionPatterns.some(pattern => {
            // 将glob模式转换为正则表达式用于检查
            const patternRegex = new RegExp(
                pattern.replace(/\*/g, '.*').replace(/\?/g, '.').replace(/\./g, '\\.'),
                'i'
            );
            
            // 检查是否有文件会被这个排除模式排除
            return batchFiles.some(file => patternRegex.test(file));
        });
        
        if (hasConflict) {
            logger.warn('警告: 排除模式可能与要搜索的文件路径冲突。考虑修改排除模式或使用更具体的路径。');
            // 如果有冲突，可以选择不使用排除模式，或者用更精确的方式应用它
            // 此处选择不使用存在冲突的排除模式
            excludeFlags = '';
        } else {
            excludeFlags = exclusionPatterns.map(pattern => `--glob=!${escapeShell(pattern)}`).join(' ');
        }
        
        logger.info(`排除模式: ${excludeFlags}`);
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

    // 防止命令过长导致问题
    const maxLogLength = 100;
    logger.info(`执行批次搜索命令: ${execString.length > maxLogLength ? 
                  execString.substring(0, maxLogLength) + '...(命令过长已截断)' : 
                  execString}`);

    // 添加超时处理，防止命令执行时间过长
    const timeoutMs = 10000; // 减少到10秒超时，更快地失败
    
    return new Promise<SearchMatch[]>((resolve, reject) => {
        const childProcess = exec(execString, {
            cwd,
            maxBuffer: 10 * 1024 * 1024, // 10MB缓冲区
            timeout: timeoutMs
        }, (error, stdout, stderr) => {
            if (stderr) {
                logger.error('Ripgrep stderr:', stderr);
            }
            
            if (error) {
                if (error.signal === 'SIGTERM') {
                    logger.error(`批次搜索超时 (${timeoutMs/1000}秒)`);
                    // 即使超时，也尝试解析已经返回的内容
                    if (stdout && stdout.trim()) {
                        try {
                            const partialResults = parseRipgrepOutput(stdout, queryString, options);
                            logger.info(`批次搜索部分成功，解析到 ${partialResults.length} 个结果`);
                            resolve(partialResults);
                            return;
                        } catch (parseError) {
                            logger.error('解析部分结果失败:', parseError);
                        }
                    }
                } else {
                    logger.error(`批次搜索错误: ${error.message || JSON.stringify(error)}`);
                }
                
                // 失败了但不抛出异常，返回空结果继续处理
                resolve([]);
                return;
            }
            
            // 成功完成
            try {
                // 如果没有匹配结果，返回空数组
                if (!stdout.trim()) {
                    resolve([]);
                    return;
                }
                
                // 解析ripgrep输出
                const results = parseRipgrepOutput(stdout, queryString, options);
                resolve(results);
            } catch (parseError) {
                logger.error('解析结果出错:', parseError);
                resolve([]); // 解析错误时返回空结果
            }
        });
        
        // 确保子进程有被清理的机会
        const killTimer = setTimeout(() => {
            try {
                if (childProcess && !childProcess.killed) {
                    logger.warn('手动终止批次搜索子进程');
                    childProcess.kill('SIGKILL');
                }
            } catch (killError) {
                logger.error('终止子进程失败:', killError);
            }
        }, timeoutMs + 2000); // 比超时多等2秒
        
        // 确保定时器被清理
        childProcess.on('exit', () => {
            clearTimeout(killTimer);
        });
    });
}

// 将ripgrep输出解析为SearchMatch数组的辅助函数
function parseRipgrepOutput(
    stdout: string, 
    queryString: string, 
    options: {isCaseSensitive: boolean; isWholeWord: boolean}
): SearchMatch[] {
    return stdout
        .trim()
        .split('\n')
        .filter((line) => line)
        .map((line) => {
            const [filePath, lineNumber, column, ...matchParts] = line.split(':');
            const matchText = matchParts.join(':').trim();
            const lineNum = parseInt(lineNumber, 10) - 1; // 转换为 0-based
            const colNum = parseInt(column, 10) - 1; // 转换为 0-based
            
            // 修复: 当查询字符串与匹配文本不同时，需要在匹配文本中找到实际查询字符串的位置
            // 创建一个不区分大小写的正则表达式来查找查询字符串在匹配文本中的位置
            const searchRegex = new RegExp(escapeRegExp(queryString), options.isCaseSensitive ? 'g' : 'gi');
            const match = searchRegex.exec(matchText);
            const matchLength = match ? match[0].length : queryString.length;
            
            return {
                filePath,
                lineNumber: lineNum + 1, // 返回 1-based 行号
                column: colNum + 1, // 返回 1-based 列号
                matchText,
                range: new vscode.Range(lineNum, colNum, lineNum, colNum + matchLength)
            };
        });
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
    cwd: string,
    progressCallback?: (current: number, total: number, status?: string) => void
): Promise<SearchMatch[]> {
    const readFileAsync = promisify(fs.readFile);
    logger.info('使用 Node.js 搜索', queryString);
    
    // 报告开始使用Node.js搜索
    if (progressCallback) {
        progressCallback(0, files.length, '启动Node.js搜索');
    }
    
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
    if (options.exclusions && options.exclusions.trim()) {
        const patterns = options.exclusions.split(',')
            .map(pattern => pattern.trim())
            .filter(pattern => pattern);
            
        patterns.forEach(pattern => {
            // 将glob模式转换为正则表达式
            const regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
            exclusionPatterns.push(new RegExp(`^${regexPattern}$`, 'i')); // 添加i标志使其不区分大小写
        });
        
        logger.info(`排除模式正则表达式: ${exclusionPatterns.map(r => r.toString()).join(', ')}`);
    }
    
    logger.info('搜索的文件:', absoluteFiles.length);
    // 搜索每个文件
    for (let i = 0; i < absoluteFiles.length; i++) {
        const filePath = absoluteFiles[i];
        
        // 更新进度
        if (progressCallback && i % 10 === 0) { // 每10个文件更新一次进度，减少更新频率
            progressCallback(i, absoluteFiles.length, `处理文件 ${i+1}/${absoluteFiles.length}`);
        }
        
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
            for (let j = 0; j < lines.length; j++) {
                const line = lines[j];
                let match;

                // 重置正则表达式的 lastIndex
                regex.lastIndex = 0;

                while ((match = regex.exec(line)) !== null) {
                    results.push({
                        filePath,
                        lineNumber: j + 1, // 1-based 行号
                        column: match.index + 1, // 1-based 列号
                        matchText: line,
                        range: new vscode.Range(j, match.index, j, match.index + match[0].length)
                    });
                }
            }
        } catch (error) {
            logger.error(`搜索文件时出错 ${filePath}:`, error);
        }
      }
    }
    
    // 完成进度
    if (progressCallback) {
        progressCallback(absoluteFiles.length, absoluteFiles.length, '搜索完成');
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
 * @param sourceUri 源URI，作为树的根节点
 * @returns 树形结构的搜索结果
 */
export function buildSearchMatchTree(
    searchResults: SearchMatch[],
    dependencies: Record<string, string[]>,
    sourceUri: vscode.Uri
): SearchMatchTree[] {
    // 先对搜索结果进行去重
    const uniqueResultsMap = new Map<string, SearchMatch>();
    searchResults.forEach(result => {
        const key = `${result.filePath}:${result.lineNumber}:${result.column}`;
        uniqueResultsMap.set(key, result);
    });
    const uniqueResults = Array.from(uniqueResultsMap.values());
    
    if (!uniqueResults.length) {
        logger.info('没有搜索结果，返回空树');
        return [];
    }
    
    // 获取源URI的文件系统信息
    const sourceUriPath = sourceUri.fsPath;
    let isDirectory = false;
    try {
        const sourceUriStat = fs.statSync(sourceUriPath);
        isDirectory = sourceUriStat.isDirectory();
    } catch (error) {
        logger.warn(`无法获取URI状态: ${sourceUriPath}，假设为文件`);
    }
    
    // 调试日志
    logger.info(`开始构建搜索树，源URI: ${sourceUriPath}，是文件夹: ${isDirectory}, ${uniqueResults.length}个搜索结果，${Object.keys(dependencies).length}个依赖项`);
    
    // 规范化文件路径，确保路径比较准确
    const normalizeFilePath = (filePath: string): string => {
        return path.normalize(filePath).replace(/\\/g, '/');
    };
    
    const sourcePath = normalizeFilePath(sourceUriPath);
    
    // 【1. 保留原始依赖对象结构】 - 避免转换丢失信息
    const normalizedDeps: Record<string, string[]> = {};
    Object.entries(dependencies).forEach(([file, deps]) => {
        const normalizedFile = normalizeFilePath(file);
        normalizedDeps[normalizedFile] = deps.map(normalizeFilePath);
    });
    
    // 【2. 简化：按文件分组】
    const resultsByFile = new Map<string, SearchMatch[]>();
    uniqueResults.forEach(result => {
        const normalizedPath = normalizeFilePath(result.filePath);
        if (!resultsByFile.has(normalizedPath)) {
            resultsByFile.set(normalizedPath, []);
        }
        resultsByFile.get(normalizedPath)!.push(result);
    });
    
    // 【3. 日志：检查是否有搜索结果分组】
    logger.info(`搜索结果已分组到 ${resultsByFile.size} 个文件中`);
    
    // 【4. 确保有根文件】
    let rootFiles: string[] = [];
    
    // 获取搜索结果中所有文件路径作为备选
    const allResultFilePaths = Array.from(resultsByFile.keys());
    
    if (isDirectory) {
        // 如果是目录，找出依赖对象中属于该目录的文件
        const dirPrefix = normalizeFilePath(sourceUriPath + '/');
        
        for (const filePath of Object.keys(normalizedDeps)) {
            const normalized = normalizeFilePath(filePath);
            if (normalized.startsWith(dirPrefix) || 
                (!path.isAbsolute(filePath) && !filePath.includes('../'))) {
                rootFiles.push(normalized);
            }
        }
        
        // 如果没找到，使用所有搜索结果文件
        if (rootFiles.length === 0) {
            rootFiles = allResultFilePaths;
        }
    } else {
        // 如果是文件，直接用该文件路径
        const fileName = path.basename(sourceUriPath);
        
        for (const filePath of Object.keys(normalizedDeps)) {
            const normalized = normalizeFilePath(filePath);
            if (normalized === sourcePath || 
                filePath === fileName || 
                filePath.endsWith('/' + fileName)) {
                rootFiles.push(normalized);
            }
        }
        
        // 回退选项
        if (rootFiles.length === 0) {
            for (const filePath of Object.keys(normalizedDeps)) {
                if (filePath.includes(fileName)) {
                    rootFiles.push(normalizeFilePath(filePath));
                }
            }
        }
        
        // 最后回退到所有搜索结果文件
        if (rootFiles.length === 0) {
            rootFiles = allResultFilePaths;
        }
    }
    
    // 【5. 去重根文件】
    rootFiles = [...new Set(rootFiles)];
    
    // 【6. 调试日志：检查是否找到根文件】
    logger.info(`找到 ${rootFiles.length} 个根文件: ${rootFiles.join(', ')}`);
    
    if (rootFiles.length === 0) {
        logger.warn('未找到根文件，无法构建树');
        // 退化处理：直接返回所有搜索结果作为平级节点
        return uniqueResults.map(result => ({
            ...result,
            children: []
        }));
    }
    
    // 用于记录处理过的文件，避免循环引用
    const processedFiles = new Set<string>();
    
    // 构建节点函数
    function buildTreeNode(filePath: string): SearchMatchTree[] {
        // 防止循环依赖
        if (processedFiles.has(filePath)) {
            logger.info(`跳过已处理的文件: ${filePath}`);
            return [];
        }
        
        // 标记为已处理
        processedFiles.add(filePath);
        
        // 获取文件的搜索结果
        const fileResults = resultsByFile.get(filePath) || [];
        
        // 没有搜索结果则跳过
        if (fileResults.length === 0) {
            logger.info(`文件无搜索结果: ${filePath}`);
            return [];
        }
        
        // 为文件中的每个搜索结果创建一个节点
        const nodes: SearchMatchTree[] = fileResults.map(result => ({
            filePath: result.filePath,
            lineNumber: result.lineNumber,
            column: result.column,
            matchText: result.matchText,
            range: result.range,
            children: []
        }));
        
        // 处理依赖
        const deps = normalizedDeps[filePath] || [];
        logger.info(`文件 ${filePath} 有 ${deps.length} 个依赖`);
        
        // 收集所有依赖节点
        const childNodes: SearchMatchTree[] = [];
        for (const depPath of deps) {
            const depNormalized = normalizeFilePath(depPath);
            // 如果依赖文件有搜索结果，则添加到子节点
            if (resultsByFile.has(depNormalized)) {
                childNodes.push(...buildTreeNode(depNormalized));
            }
        }
        
        // 将所有依赖节点添加为第一个节点的子节点
        if (nodes.length > 0 && childNodes.length > 0) {
            nodes[0].children = childNodes;
        }
        
        return nodes;
    }
    
    // 构建树
    let finalTree: SearchMatchTree[] = [];
    
    // 清空处理记录，开始构建
    processedFiles.clear();
    
    // 处理每个根文件
    for (const rootFile of rootFiles) {
        const rootNodes = buildTreeNode(rootFile);
        if (rootNodes.length > 0) {
            finalTree.push(...rootNodes);
        }
    }
    
    // 如果有必要，使用虚拟根节点
    if (isDirectory && finalTree.length > 3) {
        const virtualRoot: SearchMatchTree = {
            filePath: sourceUriPath,
            lineNumber: 0,
            column: 0,
            matchText: path.basename(sourceUriPath) + '/',
            range: new vscode.Range(0, 0, 0, 0),
            children: finalTree
        };
        finalTree = [virtualRoot];
    }
    
    // 最终安全检查：确保结果不为空
    if (finalTree.length === 0 && uniqueResults.length > 0) {
        logger.warn('构建树失败，退化为平级节点');
        return uniqueResults.map(result => ({
            ...result,
            children: []
        }));
    }
    
    logger.info(`构建完成，树节点数量: ${finalTree.length}`);
    return finalTree;
}
