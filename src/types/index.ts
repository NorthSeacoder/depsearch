import type * as vscode from 'vscode'

/**
 * Message payload structure for communication between extension and webview
 */
export interface Payload {
  title: string
  msg?: string
  entryFile?: string
  query?: string
  isCaseSensitive?: boolean
  isWholeWord?: boolean
  filePath?: string
  lineNumber?: number
  importResults?: SearchMatch[]
}

/**
 * Result of a single search match
 */
export interface SearchMatch {
  filePath: string
  lineNumber: number
  column: number
  matchText: string
  range: vscode.Range
}

/**
 * Options for configuring search behavior
 */
export interface SearchOptions {
  isCaseSensitive: boolean
  isWholeWord: boolean
}

/**
 * Parameters for executing a search command
 */
export interface SearchParams {
  uri: vscode.Uri
  query?: string
  isCaseSensitive?: boolean
  isWholeWord?: boolean
}

/**
 * Configuration for dependency parsing
 */
export interface DependencyParserOptions {
  includeNpm?: boolean
  fileExtensions?: string[]
  excludeRegExp?: RegExp[]
  detectiveOptions?: {
    ts?: {
      skipTypeImports?: boolean
    }
  }
  tsConfig?: string
  baseDir?: string
  maxDepth?: number
}

/**
 * Webview state that needs to be persisted
 */
export interface WebviewState {
  importResults?: SearchMatch[]
  searchQuery?: string
  isCaseSensitive?: boolean
  isWholeWord?: boolean
  entryFile?: string
}
