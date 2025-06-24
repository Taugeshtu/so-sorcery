// src/SorceryEditorProvider.ts
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
        try {
          const knowledge = await contextHolder.includeFileInContext(message.filePath);
          if (knowledge) {
            this.updateWebviewState(panel, contextHolder);
          } else {
            vscode.window.showErrorMessage(`Failed to include file: ${message.filePath}`);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Error including file: ${error}`);
        }
        break;
      
      case 'removeKnowledge':
        const removed = contextHolder.removeKnowledge(message.id);
        if (removed) {
          this.updateWebviewState(panel, contextHolder);
        }
        break;
      
      case 'toggleKnowledgeCollapse':
        const toggled = contextHolder.toggleKnowledgeCollapse(message.id);
        if (toggled) {
          this.updateWebviewState(panel, contextHolder);
        }
        break;
      
      case 'showInformationMessage':
        vscode.window.showInformationMessage(message.text);
        break;
      
      case 'addUserKnowledge':
        contextHolder.addKnowledge('user', message.content, message.references);
        
        if (message.runAgent) {
          try {
            // Show progress
            panel.webview.postMessage({
              command: 'setAgentRunning',
              running: true
            });
            
            const response = await contextHolder.runAgent(message.content);
            
            panel.webview.postMessage({
              command: 'setAgentRunning',
              running: false
            });
            
            // Context is already updated by runAgent, just refresh UI
            this.updateWebviewState(panel, contextHolder);
          } catch (error) {
            panel.webview.postMessage({
              command: 'setAgentRunning',
              running: false
            });
            
            vscode.window.showErrorMessage(`Agent failed: ${error}`);
            console.error('Agent run failed:', error);
          }
        } else {
          this.updateWebviewState(panel, contextHolder);
        }
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