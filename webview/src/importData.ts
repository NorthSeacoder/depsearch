// 导入搜索结果类型定义
export interface ImportSearchResult {
  filePath: string;
  lineNumber: number;
  column: number;
  matchText: string;
  range: Array<{line: number, character: number}>;
}

// 按文件分组的搜索结果
export interface FileGroup {
  filePath: string;
  fileName: string;
  directory: string;
  matches: ImportSearchResult[];
}

/**
 * 处理导入搜索结果，按文件分组
 * @param results 导入搜索结果数组
 * @returns 处理后的文件组数组和统计信息
 */
export function processImportResults(results: ImportSearchResult[]) {
  const groupedByFile: Record<string, ImportSearchResult[]> = {};
  
  // 按文件路径分组
  results.forEach(result => {
    if (!groupedByFile[result.filePath]) {
      groupedByFile[result.filePath] = [];
    }
    groupedByFile[result.filePath].push(result);
  });
  
  // 转换为文件组数组
  const fileGroups = Object.entries(groupedByFile).map(([filePath, matches]) => {
    // 提取文件名和目录
    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const directory = pathParts.slice(0, pathParts.length - 1).join('/');
    
    return {
      filePath,
      fileName,
      directory,
      matches
    };
  });
  
  // 计算总匹配数和文件数
  const totalMatches = results.length;
  const totalFiles = fileGroups.length;
  
  return {
    fileGroups,
    totalMatches,
    totalFiles
  };
}

/**
 * 获取相对路径显示
 * @param filePath 完整文件路径
 * @returns 简化后的相对路径
 */
export function getRelativePath(filePath: string): string {
  // 简化路径显示，可以根据实际需求调整
  const parts = filePath.split('/');
  if (parts.length > 3) {
    return '.../' + parts.slice(parts.length - 3).join('/');
  }
  return filePath;
}

/**
 * 从文件路径中提取项目根目录
 * @param filePaths 文件路径数组
 * @returns 推测的项目根目录
 */
export function extractProjectRoot(filePaths: string[]): string {
  if (filePaths.length === 0) return '';
  
  // 找出所有路径的共同前缀
  const paths = filePaths.map(path => path.split('/'));
  const minLength = Math.min(...paths.map(p => p.length));
  
  let commonPrefix = [];
  for (let i = 0; i < minLength; i++) {
    const segment = paths[0][i];
    if (paths.every(p => p[i] === segment)) {
      commonPrefix.push(segment);
    } else {
      break;
    }
  }
  
  return commonPrefix.join('/');
}

/**
 * 模拟数据，用于开发测试
 */
export const mockImportResults: ImportSearchResult[] = [
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
    filePath: '/Users/yqg/web/hateno/src/lib/utils.ts',
    lineNumber: 1,
    column: 1,
    matchText: 'import { clsx, type ClassValue } from "clsx";',
    range: [
      {line: 0, character: 0},
      {line: 0, character: 45}
    ]
  }
]; 