import type { SearchMatch, SearchOptions } from '../types'
import { exec } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { promisify } from 'node:util'
import { rgPath } from '@vscode/ripgrep'
import * as vscode from 'vscode'
import { logger } from '.'

const execAsync = promisify(exec)

/**
 * Search for a query string across multiple files using ripgrep
 * Falls back to Node.js implementation if ripgrep is unavailable
 */
export async function searchInFilesWithRipgrep(
  files: string[],
  queryString: string,
  options: SearchOptions,
  sourceUri: vscode.Uri,
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

  try {
    return await searchWithRipgrep(files, queryString, options, cwd)
  }
  catch (error) {
    logger.error('Ripgrep search failed:', error)
    logger.info('Falling back to Node.js implementation')
    return await searchWithNodeJs(files, queryString, options, cwd)
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
  options: SearchOptions,
  cwd: string,
): Promise<SearchMatch[]> {
  const flags = options.isCaseSensitive ? 'g' : 'gi'
  const pattern = options.isWholeWord ? `\\b${escapeRegExp(queryString)}\\b` : escapeRegExp(queryString)
  const regex = new RegExp(pattern, flags)

  const results: SearchMatch[] = []

  const absoluteFiles = files.map(file =>
    path.isAbsolute(file) ? file : path.join(cwd, file),
  )

  for (const filePath of absoluteFiles) {
    try {
      const exists = await fileExists(filePath)
      if (!exists) {
        logger.warn(`File not found: ${filePath}`)
        continue
      }

      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        regex.lastIndex = 0 // Reset regex state

        let match = regex.exec(line)
        while (match !== null) {
          results.push({
            filePath,
            lineNumber: i + 1, // 1-based line number
            column: match.index + 1, // 1-based column number
            matchText: line,
            range: new vscode.Range(i, match.index, i, match.index + match[0].length),
          })
          match = regex.exec(line)
        }
      }
    }
    catch (error) {
      logger.error(`Error searching file ${filePath}:`, error)
    }
  }

  return results
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
