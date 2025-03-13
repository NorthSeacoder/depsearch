import * as vscode from 'vscode';
import { Uri, WebviewView, WebviewViewProvider, Webview } from 'vscode';
import { getUri, getNonce } from './utils';
import { Payload } from './types';
import { WEBVIEW_DIST_PATH, INDEX_JS, INDEX_CSS, EXTENSION_SCOPE } from './constants';

export class SvelteViewProvider implements WebviewViewProvider {
  private view?: WebviewView;
  private readonly extensionUri: Uri;

  constructor(uri: Uri) {
    this.extensionUri = uri;
  }

  public resolveWebviewView(webviewView: WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.extensionUri, WEBVIEW_DIST_PATH)],
    };
    webviewView.webview.html = this.getWebviewContent(webviewView.webview);
    this.setWebviewMessageListener(webviewView.webview);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.postGreeting();
      }
    });
  }

  public post(content: Payload) {
    if (this.view) {
      this.view.webview.postMessage(content);
    }
  }

  public show() {
    if (this.view) {
      this.view.show();
      this.postGreeting();
    }
  }

  private postGreeting() {
    const greeting = vscode.workspace
      .getConfiguration(EXTENSION_SCOPE)
      .get<string>('greetingMessage', '您好，这是从扩展发送的消息！');
    this.post({ title: 'greeting', msg: greeting });
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
    webview.onDidReceiveMessage((message: Payload) => {
      if (!message || typeof message.title !== 'string' || typeof message.msg !== 'string') {
        vscode.window.showErrorMessage('接收到的消息格式无效');
        return;
      }
      switch (message.title) {
        case 'hello':
          vscode.window.showInformationMessage(message.msg);
          break;
      }
    });
  }
}