import * as vscode from 'vscode';
import { getFilteredFilePaths } from './fileDiscovery';
import { ContextHolder } from './contextHolder';
import { getWebviewHtml } from './webview/htmlTemplate';
import { updateAvailableFiles, getAvailableFiles } from './types';

export class SorceryEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'sorcery.contextEditor';
  private contextHolders = new Map<string, ContextHolder>();
  private currentlyFocusedPanel: vscode.WebviewPanel | undefined;
  private panelToDocument = new Map<vscode.WebviewPanel, vscode.TextDocument>();
  
  constructor(
    private readonly context: vscode.ExtensionContext
  ) {}
  
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ) {
    this.currentlyFocusedPanel = webviewPanel;
    this.panelToDocument.set(webviewPanel, document);
    
    // Get workspace name
    const workspaceName = vscode.workspace.name || 'Unknown Workspace';
    
    // really we only need to do it once... but fine...
    // Hey, bonus shadow feature - now each time we open up new sorcery, we get an update to files list everywhere!
    this.refreshFiles( webviewPanel );
    
    // Create or get context holder for this document
    const contextHolder = new ContextHolder(document, workspaceName, () => this.updateWebviewState(webviewPanel, contextHolder));
    this.contextHolders.set(document.uri.toString(), contextHolder);

    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);
    
    // Set up message handling
    webviewPanel.webview.onDidReceiveMessage(
      message => this.handleWebviewMessage(message, contextHolder, webviewPanel),
      undefined,
      this.context.subscriptions
    );
    
    webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active) {
        this.currentlyFocusedPanel = e.webviewPanel;
      } else if (this.currentlyFocusedPanel === e.webviewPanel) {
        // Clear if this panel lost focus
        this.currentlyFocusedPanel = undefined;
      }
    });
    
    // Clean up on dispose
    webviewPanel.onDidDispose(() => {
      this.contextHolders.delete(document.uri.toString());
      if (this.currentlyFocusedPanel === webviewPanel) {
        this.currentlyFocusedPanel = undefined;
      }
      this.panelToDocument.delete(webviewPanel);
    });
    
    // Initialize webview with current state
    this.updateWebviewState(webviewPanel, contextHolder);
  }
  
  private async refreshFiles(panel: vscode.WebviewPanel) {
    const filePaths = await getFilteredFilePaths();
    updateAvailableFiles(filePaths);
    
    panel.webview.postMessage({
        command: 'updateFiles',
        availableFiles: getAvailableFiles()
    });
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
      
      case 'refreshFiles':
        this.refreshFiles(panel);
        break;
      
      case 'addFileToContext':
        try {
          const knowledge = contextHolder.emitFileKnowledge( message.filePath );
          if (knowledge) {
            contextHolder.addItem( knowledge );
          } else {
            vscode.window.showErrorMessage(`Failed to include file: ${message.filePath}`);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Error including file: ${error}`);
        }
        break;
      
      case 'removeItem':
        contextHolder.removeItem(message.id);
        break;
      
      case 'toggleItemCollapse':
        contextHolder.toggleItemCollapse(message.id);
        break;
      
      case 'showInformationMessage':
        vscode.window.showInformationMessage(message.text);
        break;
      
      case 'addUserKnowledge':
        const emitted = contextHolder.emitKnowledge('user', message.content);
        contextHolder.addItem(emitted);
        break;
      
      case 'runAgent':
        try {
          panel.webview.postMessage({
            command: 'setAgentRunning',
            running: true
          });
          
          const response = await contextHolder.runPA();
          
          panel.webview.postMessage({
            command: 'setAgentRunning',
            running: false
          });
        } catch (error) {
          panel.webview.postMessage({
            command: 'setAgentRunning',
            running: false
          });
          
          vscode.window.showErrorMessage(`Agent failed: ${error}`);
          console.error('Agent run failed:', error);
        }
        break;
      
      case 'executeWorkItem':
        try {
          contextHolder.executeToolWorkItem(message.id);
        } catch (error) {
          vscode.window.showErrorMessage(`Work item execution failed: ${error}`);
        }
        break;
    }
  }
  
  private getHtml(webview: vscode.Webview): string {
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'styles.css')
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'main.js')
    );
    
    return getWebviewHtml(webview, cssUri, jsUri);
  }
  
  public getCurrentlyFocusedPanel(): vscode.WebviewPanel | undefined {
    return this.currentlyFocusedPanel;
  }
  
  public getCurrentDocumentUri(): vscode.Uri | undefined {
    if (!this.currentlyFocusedPanel) {
      return undefined;
    }
    const document = this.panelToDocument.get(this.currentlyFocusedPanel);
    return document?.uri;
  }
  
  public getWorkspaceCost(): number {
    let total = 0;
    for (const contextHolder of this.contextHolders.values()) {
      total += contextHolder.getAccumulatedCost();
    }
    return total;
  }
}