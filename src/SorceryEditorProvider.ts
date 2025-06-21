import * as vscode from 'vscode';

export class SorceryEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'sorcery.contextEditor';

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ) {
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    // No document change handling for now

    webviewPanel.webview.onDidReceiveMessage(msg => {
      // No message handling for now
    });
  }

  private getHtml(webview: vscode.Webview): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <body>
        <h1>Test String: Custom Editor Loaded!</h1>
      </body>
      </html>
    `;
  }
}
