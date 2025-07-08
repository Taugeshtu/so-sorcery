import * as vscode from 'vscode';
import { getFilteredFilePaths } from './fileDiscovery';
import { SessionController } from './session';
import { getWebviewHtml } from './webview/htmlTemplate';
import { updateAvailableFiles, getAvailableFiles } from './types';
import { updateCostDisplay } from './extension'

export class SorceryEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'sorcery.contextEditor';
  private sessionControllers = new Map<string, SessionController>();
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
    const sessionController = new SessionController(document, workspaceName, () => this.updateWebviewState(webviewPanel, sessionController));
    this.sessionControllers.set(document.uri.toString(), sessionController);

    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);
    
    // Set up message handling
    webviewPanel.webview.onDidReceiveMessage(
      message => this.handleWebviewMessage(message, sessionController, webviewPanel),
      undefined,
      this.context.subscriptions
    );
    
    webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active) {
        this.currentlyFocusedPanel = e.webviewPanel;
        updateCostDisplay();
      } else if (this.currentlyFocusedPanel === e.webviewPanel) {
        this.currentlyFocusedPanel = undefined;
        updateCostDisplay();
      }
    });
    
    // Clean up on dispose
    webviewPanel.onDidDispose(() => {
      this.sessionControllers.delete(document.uri.toString());
      if (this.currentlyFocusedPanel === webviewPanel) {
        this.currentlyFocusedPanel = undefined;
      }
      this.panelToDocument.delete(webviewPanel);
    });
    
    // Initialize webview with current state
    this.updateWebviewState(webviewPanel, sessionController);
  }
  
  private async refreshFiles(panel: vscode.WebviewPanel) {
    const filePaths = await getFilteredFilePaths();
    updateAvailableFiles(filePaths);
    
    panel.webview.postMessage({
        command: 'updateFiles',
        availableFiles: getAvailableFiles()
    });
  }
  
  private async updateWebviewState(panel: vscode.WebviewPanel, sessionController: SessionController) {
    const session = sessionController.getSession();
    const psycheStates = sessionController.getPsycheExecutionStates();
    
    panel.webview.postMessage({
        command: 'updateState',
        context: session,
        psycheStates
    });
  }
  
  private async handleWebviewMessage(
    message: any, 
    sessionController: SessionController, 
    panel: vscode.WebviewPanel
  ) {
    switch (message.command) {
      
      case 'refreshFiles':
        this.refreshFiles(panel);
        break;
      
      case 'addFileToContext':
        try {
          const knowledge = sessionController.emitFileKnowledge( message.filePath );
          if (knowledge) {
            sessionController.addItem( knowledge );
          } else {
            vscode.window.showErrorMessage(`Failed to include file: ${message.filePath}`);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Error including file: ${error}`);
        }
        break;
      
      case 'removeItem':
        sessionController.removeItem(message.id);
        break;
      
      case 'toggleItemCollapse':
        sessionController.toggleItemCollapse(message.id);
        break;
      
      case 'showInformationMessage':
        vscode.window.showInformationMessage(message.text);
        break;
      
      case 'addUserKnowledge':
        const emitted = sessionController.emitKnowledge('user', 'user', message.content);
        sessionController.addItem(emitted);
        break;
      
      case 'runAgent':
        try {
          panel.webview.postMessage({
            command: 'setAgentRunning',
            running: true
          });
          
          await sessionController.run();
          
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
          sessionController.executeWorkItem(message.id);
        } catch (error) {
          vscode.window.showErrorMessage(`Work item execution failed: ${error}`);
        }
        break;
      
      case 'updateDraft':
        if (sessionController) {
          sessionController.updateInputDraft(message.draft);
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
  
  public getFocusedSessionCost(): number {
    if (!this.currentlyFocusedPanel || !this.panelToDocument || !this.sessionControllers) {
      return 0;
    }
    
    const document = this.panelToDocument.get(this.currentlyFocusedPanel);
    if (!document) {
      return 0;
    }
    
    const sessionController = this.sessionControllers.get(document.uri.toString());
    return sessionController ? sessionController.getSession().accumulatedCost : 0;
  }
}