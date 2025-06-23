// sorceryEditorProvider.ts
import * as vscode from 'vscode';
import { getFilteredFilePaths } from './fileDiscovery';
import { ContextHolder } from './contextHolder';

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

    await this.updateFileList(webviewPanel, contextHolder);
    this.updateKnowledgesList(webviewPanel, contextHolder);
  }

  private async handleWebviewMessage(
    message: any, 
    contextHolder: ContextHolder, 
    panel: vscode.WebviewPanel
  ) {
    switch (message.command) {
      case 'addFileToContext':
        const success = contextHolder.addFileKnowledge(message.filePath);
        if (success) {
          this.updateKnowledgesList(panel, contextHolder);
          vscode.window.showInformationMessage(`Added ${message.filePath} to context`);
        } else {
          vscode.window.showWarningMessage(`${message.filePath} is already in context`);
        }
        break;
    }
  }

  private async updateFileList(panel: vscode.WebviewPanel, contextHolder: ContextHolder) {
    const filePaths = await getFilteredFilePaths();
    contextHolder.updateAvailableFiles(filePaths);
    
    const listItems = filePaths.map(p => `<li onclick="addFileToContext('${p}')">${p}</li>`).join('\n');

    panel.webview.postMessage({
      command: 'loadFiles',
      filePaths,
      listItems
    });
  }

  private updateKnowledgesList(panel: vscode.WebviewPanel, contextHolder: ContextHolder) {
    const knowledges = contextHolder.getKnowledges();
    
    panel.webview.postMessage({
      command: 'loadKnowledges',
      knowledges
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const sidebarHtml = `
      <div id="sidebar">
        <div class="collapsible-section">
          <h2 class="collapsible-header" onclick="toggleSection('projectFiles')">
            <span class="arrow" id="projectFiles-arrow">▼</span>
            Project Files
          </h2>
          <div class="collapsible-content" id="projectFiles-content">
            <ul id="filesList"></ul>
          </div>
        </div>

        <div class="collapsible-section">
          <h2 class="collapsible-header" onclick="toggleSection('contextFiles')">
            <span class="arrow" id="contextFiles-arrow">▼</span>
            Files in Context
          </h2>
          <div class="collapsible-content" id="contextFiles-content">
            <ul id="contextFilesList"></ul>
          </div>
        </div>
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <style>
          body { margin: 0; padding: 0; height: 100vh; display: flex; font-family: sans-serif; }
          #main { flex: 1; padding: 10px; overflow-y: auto; }
          #sidebar { width: 300px; border-left: 1px solid #ddd; padding: 10px; box-sizing: border-box; overflow-y: auto; }
          
          .collapsible-section { margin-bottom: 20px; }
          
          .collapsible-header { 
            margin: 0; 
            font-size: 1.1em; 
            cursor: pointer; 
            user-select: none;
            display: flex;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px solid #eee;
          }
          .collapsible-header:hover { background-color: rgba(0,0,0,0.05); }
          
          .arrow { 
            margin-right: 8px; 
            transition: transform 0.2s ease;
            font-size: 0.8em;
          }
          .arrow.collapsed { transform: rotate(-90deg); }
          
          .collapsible-content { 
            overflow: hidden;
            transition: max-height 0.3s ease;
          }
          .collapsible-content.collapsed { 
            max-height: 0; 
          }
          
          #filesList, #contextFilesList { 
            list-style: none; 
            padding-left: 0; 
            margin: 8px 0;
          }
          #filesList li, #contextFilesList li { 
            padding: 6px 8px; 
            cursor: pointer;
            border-radius: 3px;
            margin: 2px 0;
            font-size: 0.9em;
          }
          #filesList li:hover { 
            background-color: rgba(0,120,215,0.1); 
            border: 1px solid rgba(0,120,215,0.3);
          }
          #contextFilesList li {
            background-color: rgba(0,120,215,0.1);
            color: #333;
          }

          .knowledge-item {
            border: 1px solid #ddd;
            border-radius: 4px;
            margin: 10px 0;
            padding: 10px;
          }
          .knowledge-header {
            font-weight: bold;
            color: #666;
            font-size: 0.9em;
            margin-bottom: 5px;
          }
          .knowledge-content {
            background-color: #f9f9f9;
            padding: 8px;
            border-radius: 3px;
            font-family: monospace;
            font-size: 0.9em;
          }
        </style>
      </head>
      <body>
        <div id="main">
          <h1>Sorcery Context</h1>
          <div id="knowledgesList"></div>
        </div>
        ${sidebarHtml}
        <script nonce="${Date.now().toString()}">
          const vscode = acquireVsCodeApi();
          
          function toggleSection(sectionId) {
            const content = document.getElementById(sectionId + '-content');
            const arrow = document.getElementById(sectionId + '-arrow');
            
            if (content.classList.contains('collapsed')) {
              content.classList.remove('collapsed');
              arrow.classList.remove('collapsed');
              content.style.maxHeight = content.scrollHeight + 'px';
            } else {
              content.classList.add('collapsed');
              arrow.classList.add('collapsed');
              content.style.maxHeight = '0';
            }
          }

          function addFileToContext(filePath) {
            vscode.postMessage({
              command: 'addFileToContext',
              filePath: filePath
            });
          }
          
          window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.command === 'loadFiles') {
              const filesList = document.getElementById('filesList');
              filesList.innerHTML = msg.listItems;
              
              // Update max-height for the animation
              const content = document.getElementById('projectFiles-content');
              if (!content.classList.contains('collapsed')) {
                content.style.maxHeight = content.scrollHeight + 'px';
              }
            } else if (msg.command === 'loadKnowledges') {
              updateKnowledgesDisplay(msg.knowledges);
            }
          });

          function updateKnowledgesDisplay(knowledges) {
            const knowledgesList = document.getElementById('knowledgesList');
            const contextFilesList = document.getElementById('contextFilesList');
            
            // Update main knowledges list
            knowledgesList.innerHTML = knowledges.map(k => \`
              <div class="knowledge-item">
                <div class="knowledge-header">
                  #\${k.id} - \${k.type}\${k.metadata?.timestamp ? ' (' + new Date(k.metadata.timestamp).toLocaleTimeString() + ')' : ''}
                </div>
                <div class="knowledge-content">\${k.content}</div>
              </div>
            \`).join('');

            // Update context files sidebar
            const fileKnowledges = knowledges.filter(k => k.type === 'file');
            contextFilesList.innerHTML = fileKnowledges.map(k => 
              \`<li>\${k.metadata?.filePath || k.content}</li>\`
            ).join('');

            // Update max-height for animations
            const content = document.getElementById('contextFiles-content');
            if (!content.classList.contains('collapsed')) {
              content.style.maxHeight = content.scrollHeight + 'px';
            }
          }
          
          // Initialize sections as expanded
          document.addEventListener('DOMContentLoaded', () => {
            ['projectFiles', 'contextFiles'].forEach(sectionId => {
              const content = document.getElementById(sectionId + '-content');
              content.style.maxHeight = content.scrollHeight + 'px';
            });
          });
        </script>
      </body>
      </html>
    `;
  }
}