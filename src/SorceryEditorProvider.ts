import * as vscode from 'vscode';

export class SorceryEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'sorcery.contextEditor';

  constructor(private readonly ctx: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ) {
    // 1. Configure webview
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getWebviewHtml(webviewPanel.webview);

    // 2. When the file changes on disk, update UI
    const changeDoc = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.postState(webviewPanel, document.getText());
      }
    });

    // 3. When UI posts edits, apply to the document
    webviewPanel.webview.onDidReceiveMessage(msg => {
      if (msg.command === 'update') {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
          document.uri,
          new vscode.Range(0, 0, document.lineCount, 0),
          msg.text
        );
        return vscode.workspace.applyEdit(edit);
      }
    });

    // 4. Initial state push
    this.postState(webviewPanel, document.getText());

    webviewPanel.onDidDispose(() => changeDoc.dispose());
  }

  private postState(panel: vscode.WebviewPanel, text: string) {
    let data: any = {};
    try { data = JSON.parse(text); } catch {}
    panel.webview.postMessage({ command: 'load', data });
  }

  private getWebviewHtml(webview: vscode.Webview) {
    const nonce = Date.now().toString();
    return /* html */`
      <!DOCTYPE html>
      <body>
        <div id="app"></div>
        <script nonce="${nonce}">
          // React/Vue/Svelte app bootstrap could go here.
          const vscode = acquireVsCodeApi();
          window.addEventListener('message', ev => {
            const { data } = ev.data;
            // render your custom UI: file list, chat, etc.
          });
          // when your UI wants to save:
          // vscode.postMessage({ command: 'update', text: JSON.stringify(myState) });
        </script>
      </body>
    `;
  }
}
