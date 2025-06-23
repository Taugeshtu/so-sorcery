// sorceryEditorProvider.ts
import * as vscode from 'vscode';
import { getFilteredFilePaths } from './fileDiscovery';
import { ContextHolder } from './contextHolder';
import { getWebviewHtml } from './webview/htmlTemplate';

export class SorceryEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'sorcery.contextEditor';
  private contextHolders = new Map<string, ContextHolder>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ) {
    // Get workspace name
    const workspaceName = vscode.workspace.name || 'Unknown Workspace';
    
    // Create or get context holder for this document
    const contextHolder = new ContextHolder(document, workspaceName);
    this.contextHolders.set(document.uri.toString(), contextHolder);

    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);
    
    // Set up message handling
    webviewPanel.webview.onDidReceiveMessage(
      message => this.handleWebviewMessage(message, contextHolder, webviewPanel),
      undefined,
      this.context.subscriptions
    );

    // Clean up on dispose
    webviewPanel.onDidDispose(() => {
      this.contextHolders.delete(document.uri.toString());
    });

    // Initialize webview with current state
    await this.initializeWebview(webviewPanel, contextHolder);
  }

  private async initializeWebview(panel: vscode.WebviewPanel, contextHolder: ContextHolder) {
    // Get fresh file list and update context
    const filePaths = await getFilteredFilePaths();
    contextHolder.updateAvailableFiles(filePaths);
    
    // Send complete state to webview
    this.updateWebviewState(panel, contextHolder);
  }
  
  private async updateWebviewState(panel: vscode.WebviewPanel, contextHolder: ContextHolder) {
    const context = contextHolder.getContext();
    
    panel.webview.postMessage({
        command: 'updateState',
        context
    });
  }
  
   private async handleWebviewMessage(
    message: any, 
    contextHolder: ContextHolder, 
    panel: vscode.WebviewPanel
  ) {
    switch (message.command) {
      case 'addFileToContext':
        const added = contextHolder.addFileKnowledge(message.filePath);
        if (added) {
          this.updateWebviewState(panel, contextHolder);
        }
        break;
      
      case 'removeKnowledge':
        const removed = contextHolder.removeKnowledge(message.id);
        if (removed) {
          this.updateWebviewState(panel, contextHolder);
        }
        break;
      
      case 'addUserKnowledge':
        contextHolder.addKnowledge('user', message.content, message.references);
        this.updateWebviewState(panel, contextHolder);
        break;
    }
  }
  
  private getHtml(webview: vscode.Webview): string {
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'styles.css')
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'script.js')
    );
    
    return getWebviewHtml(webview, cssUri, jsUri);
  }
}