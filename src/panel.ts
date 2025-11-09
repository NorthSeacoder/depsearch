import type { Webview, WebviewView, WebviewViewProvider } from 'vscode'
import type { Payload, WebviewState } from './types'
import * as vscode from 'vscode'
import { Uri } from 'vscode'
import { INDEX_CSS, INDEX_JS, WEBVIEW_DIST_PATH } from './constants'
import { getNonce, getUri, logger } from './utils'

/**
 * Provider for the DepSearch webview panel
 * Manages the lifecycle and communication with the Svelte-based UI
 */
export class SvelteViewProvider implements WebviewViewProvider {
  private view?: WebviewView
  private readonly extensionUri: Uri
  private lastState: WebviewState = {}

  constructor(uri: Uri) {
    this.extensionUri = uri
  }

  public resolveWebviewView(webviewView: WebviewView): void {
    this.view = webviewView
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.extensionUri, WEBVIEW_DIST_PATH)],
    }
    webviewView.webview.html = this.getWebviewContent(webviewView.webview)
    this.setWebviewMessageListener(webviewView.webview)

    // Restore state when panel becomes visible
    this.view.onDidChangeVisibility(() => {
      logger.info('onDidChangeVisibility:', this.view?.visible)
      if (this.view?.visible && this.hasState()) {
        this.post({
          title: 'restoreState',
          ...this.lastState,
        })
      }
    })
  }

  /**
   * Check if there's any state to restore
   */
  private hasState(): boolean {
    return Boolean(this.lastState.importResults && this.lastState.importResults.length > 0)
  }

  /**
   * Post a message to the webview
   */
  public post(content: Payload): void {
    if (this.view) {
      this.view.webview.postMessage(content)
    }
  }

  /**
   * Show the webview panel
   */
  public show(): void {
    if (this.view) {
      this.view.show()
    }
  }

  /**
   * Update the persisted state
   */
  public updateState(state: Partial<WebviewState>): void {
    this.lastState = { ...this.lastState, ...state }
  }

  /**
   * Generate the HTML content for the webview
   */
  private getWebviewContent(webview: Webview): string {
    const scriptUri = getUri(webview, this.extensionUri, [WEBVIEW_DIST_PATH, INDEX_JS])
    const styleUri = getUri(webview, this.extensionUri, [WEBVIEW_DIST_PATH, INDEX_CSS])
    const nonce = getNonce()

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
        <title>DepSearch</title>
        <link href="${styleUri}" rel="stylesheet" />
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      </head>
      <body>
        <div id="app"></div>
      </body>
      </html>
    `
  }

  /**
   * Set up message listener for webview communication
   */
  private setWebviewMessageListener(webview: Webview): void {
    webview.onDidReceiveMessage(async (message: Payload) => {
      if (!this.isValidMessage(message)) {
        vscode.window.showErrorMessage('接收到的消息格式无效')
        return
      }

      switch (message.title) {
        case 'search':
          await this.handleSearch(message)
          break

        case 'openFile':
          await this.handleOpenFile(message)
          break

        default:
          logger.warn('未知的消息类型:', message.title)
      }
    })
  }

  /**
   * Validate incoming message structure
   */
  private isValidMessage(message: unknown): message is Payload {
    return typeof message === 'object' && message !== null && typeof (message as Payload).title === 'string'
  }

  /**
   * Handle search request from webview
   */
  private async handleSearch(message: Payload): Promise<void> {
    if (!message.entryFile || !message.query) {
      const errorMsg = !message.entryFile ? '请先选择一个入口文件' : '请输入搜索关键词'
      vscode.window.showWarningMessage(errorMsg)
      this.post({
        title: 'searchError',
        msg: errorMsg,
      })
      return
    }

    try {
      const uri = vscode.Uri.file(message.entryFile)

      // Execute search command
      await vscode.commands.executeCommand('depsearch.search', {
        uri,
        query: message.query,
        isCaseSensitive: message.isCaseSensitive || false,
        isWholeWord: message.isWholeWord || false,
      })

      // Update state after successful search
      this.updateState({
        searchQuery: message.query,
        isCaseSensitive: message.isCaseSensitive,
        isWholeWord: message.isWholeWord,
        entryFile: message.entryFile,
      })
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : '搜索执行失败'
      vscode.window.showErrorMessage(errorMessage)
      this.post({
        title: 'searchError',
        msg: errorMessage,
      })
    }
  }

  /**
   * Handle file open request from webview
   */
  private async handleOpenFile(message: Payload): Promise<void> {
    if (!message.filePath || typeof message.lineNumber !== 'number') {
      logger.warn('打开文件缺少必要参数')
      return
    }

    try {
      const uri = vscode.Uri.file(message.filePath)
      const document = await vscode.workspace.openTextDocument(uri)
      const editor = await vscode.window.showTextDocument(document)

      // Line numbers are 1-based, convert to 0-based
      const lineNumber = Math.max(0, message.lineNumber - 1)
      const line = document.lineAt(lineNumber)

      // Select the entire line
      editor.selection = new vscode.Selection(lineNumber, 0, lineNumber, line.text.length)

      // Reveal the line in the center of the editor
      editor.revealRange(
        new vscode.Range(lineNumber, 0, lineNumber, 0),
        vscode.TextEditorRevealType.InCenter,
      )
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : '无法打开文件'
      vscode.window.showErrorMessage(`打开文件失败: ${errorMessage}`)
    }
  }
}
