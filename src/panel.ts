import * as vscode from 'vscode';
import {Uri, WebviewView, WebviewViewProvider, Webview} from 'vscode';
import {getUri, getNonce, logger} from './utils';
import {Payload} from './types';
import {WEBVIEW_DIST_PATH, INDEX_JS, INDEX_CSS, EXTENSION_SCOPE} from './constants';

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

    constructor(uri: Uri) {
        this.extensionUri = uri;
    }

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
          logger.info('onDidChangeVisibility:', this.view?.visible);
            if (this.view?.visible) {
                this.post({
                    title: 'restoreState',
                    ...this.lastState
                });
            }
        }
        );
    }

    public post(content: Payload) {
        if (this.view) {
            this.view.webview.postMessage(content);
        }
    }

    public show() {
        if (this.view) {
            this.view.show();
        }
    }

    private getWebviewContent(webview: Webview) {
        const scriptUri = getUri(webview, this.extensionUri, [WEBVIEW_DIST_PATH, INDEX_JS]);
        const styleUri = getUri(webview, this.extensionUri, [WEBVIEW_DIST_PATH, INDEX_CSS]);
        const nonce = getNonce();

        return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
        <title>Extension Display Name</title>
        <link href="${styleUri}" rel="stylesheet" />
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      </head>
      <body>
        <div id="app"></div>
      </body>
      </html>
    `;
    }

    private setWebviewMessageListener(webview: Webview) {
        webview.onDidReceiveMessage(async (message: Payload) => {
            if (!message || typeof message.title !== 'string') {
                vscode.window.showErrorMessage('接收到的消息格式无效');
                return;
            }

            switch (message.title) {
                case 'search':
                    // 执行搜索
                    if (message.entryFile && message.query) {
                        try {
                            // 创建 URI
                            const uri = vscode.Uri.file(message.entryFile);

                            // 调用搜索命令
                            await vscode.commands.executeCommand('depsearch.search', {
                                uri,
                                query: message.query,
                                isCaseSensitive: message.isCaseSensitive || false,
                                isWholeWord: message.isWholeWord || false
                            });
                            this.lastState = {
                                importResults: message.importResults,
                                searchQuery: message.query,
                                isCaseSensitive: message.isCaseSensitive,
                                isWholeWord: message.isWholeWord,
                                entryFile: message.entryFile
                            };
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : '搜索执行失败';
                            vscode.window.showErrorMessage(errorMessage);
                            this.post({
                                title: 'searchError',
                                msg: errorMessage
                            });
                        }
                    } else {
                        const errorMsg = !message.entryFile ? '请先选择一个入口文件' : '请输入搜索关键词';

                        vscode.window.showWarningMessage(errorMsg);
                        this.post({
                            title: 'searchError',
                            msg: errorMsg
                        });
                    }
                    break;

                case 'openFile':
                    // 打开文件
                    if (message.filePath && typeof message.lineNumber === 'number') {
                        try {
                            const uri = vscode.Uri.file(message.filePath);
                            const document = await vscode.workspace.openTextDocument(uri);

                            // 打开文档并跳转到指定行
                            const editor = await vscode.window.showTextDocument(document);

                            // 行号从 1 开始，需要减 1 转为 0 开始
                            const lineNumber = Math.max(0, message.lineNumber - 1);
                            const line = document.lineAt(lineNumber);

                            // 选择整行
                            editor.selection = new vscode.Selection(lineNumber, 0, lineNumber, line.text.length);

                            // 滚动到可见区域
                            editor.revealRange(
                                new vscode.Range(lineNumber, 0, lineNumber, 0),
                                vscode.TextEditorRevealType.InCenter
                            );
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : '无法打开文件';
                            vscode.window.showErrorMessage(`打开文件失败: ${errorMessage}`);
                        }
                    }
                    break;
            }
        });
    }
}
