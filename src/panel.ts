import * as vscode from 'vscode';
import {Uri, WebviewView, WebviewViewProvider, Webview} from 'vscode';
import {getUri, getNonce, logger} from './utils';
import {Payload} from './types';
import {WEBVIEW_DIST_PATH, INDEX_JS, INDEX_CSS, PREACT_JS, UI_JS} from './constants';

/**
 * Provider for the DepSearch webview panel
 * Manages the lifecycle and communication with the Svelte-based UI
 */
export class SvelteViewProvider implements WebviewViewProvider {
    private view?: WebviewView;
    private readonly extensionUri: Uri;
    private lastState: {
        importResults?: any[];
        searchQuery?: string;
        isCaseSensitive?: boolean;
        isWholeWord?: boolean;
        entryFile?: string;
    } = {}; // 保存所有状态
    private messageQueue: Payload[] = []; // 消息队列
    private isWebviewReady = false; // webview是否就绪

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

    public resolveWebviewView(webviewView: WebviewView) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [Uri.joinPath(this.extensionUri, WEBVIEW_DIST_PATH)]
        };
        webviewView.webview.html = this.getWebviewContent(webviewView.webview);
        this.setWebviewMessageListener(webviewView.webview);
        // 恢复上次的完整状态
        this.view.onDidChangeVisibility(() => {
            if (this.view?.visible) {
                this.post({
                    title: 'restoreState',
                    ...this.lastState
                });
            }else{
                this.isWebviewReady = false;
            }
        }
        );
    }
  }

    // 将消息加入队列
    public enqueueMessage(content: Payload) {
        if (this.isWebviewReady && this.view) {
            // 如果webview已就绪，直接发送
            logger.info('直接发送消息:', content);
            this.post(content);
        } else {
            // 否则加入队列等待发送
            this.messageQueue.push(content);
        }
    }

    public post(content: Payload) {
        if (this.view) {
            this.view.webview.postMessage(content);
        }
    }
  }

    public show() {
        if (this.view) {
            this.view.show();
        } else {
            // 如果视图尚未创建，使用命令激活它
            vscode.commands.executeCommand('workbench.view.extension.depsearch-explorer').then(() => {
                logger.info('视图已激活');
                // 可以在这里添加一些回调处理，但要注意view可能还没有设置好
            });
        }
    }

    private getWebviewContent(webview: Webview) {
        const scriptUri = getUri(webview, this.extensionUri, [WEBVIEW_DIST_PATH, INDEX_JS]);
        const styleUri = getUri(webview, this.extensionUri, [WEBVIEW_DIST_PATH, INDEX_CSS]);
        const preactUri = getUri(webview, this.extensionUri, [WEBVIEW_DIST_PATH, PREACT_JS]);
        const uiUri = getUri(webview, this.extensionUri, [WEBVIEW_DIST_PATH, UI_JS]);
        const nonce = getNonce();

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <title>Extension Display Name</title>
        <link href="${styleUri}" rel="stylesheet" />
        <script type="module" nonce="${nonce}" src="${preactUri}"></script>
        <script type="module" nonce="${nonce}" src="${uiUri}"></script>
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      </head>
      <body class="dark">
        <div id="root"></div>
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

    // 处理webview就绪事件
    private handleWebviewReady() {
        this.isWebviewReady = true;
        
        // 发送队列中的所有消息
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
                this.post(message);
            }
        }
    }

    private setWebviewMessageListener(webview: Webview) {
        webview.onDidReceiveMessage(async (message: Payload) => {
            if (!message || typeof message.title !== 'string') {
                vscode.window.showErrorMessage('接收到的消息格式无效');
                return;
            }
            logger.info('接收到的消息:', JSON.stringify(message));
            switch (message.title) {
                case 'webviewReady':
                    this.handleWebviewReady(); // 处理webview就绪事件
                    break;
                case 'search':
                    // 执行搜索
                    if (message.entryFile && message.query) {
                        try {
                            // 创建 URI
                            const uri = vscode.Uri.file(message.entryFile);

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
