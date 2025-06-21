import * as path from 'path';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
    
    // Load and send the file list
    this.updateFileList(webviewPanel);
    // No document change handling for test
    // No message handling for test
  }
  
  private async getFilteredFilePaths(): Promise<string[]> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return [];
    }

    const exts = vscode.workspace.getConfiguration('sorcery')
      .get<string[]>('includeFileExtensions') || [];
    
    try {
      // First, get ALL files using VSCode (this finds everything)
      const includeGlob = `**/*{${exts.join(',')}}`;
      const uris = await vscode.workspace.findFiles(includeGlob, `.sorcery/**`);
      const allFiles = uris.map(u => path.relative(folder.uri.fsPath, u.fsPath));
      
      // Now filter each file through git check-ignore
      const filteredFiles: string[] = [];
      for (const file of allFiles) {
        try {
          // Check if git ignores this file (respects ALL nested .gitignore files)
          await execAsync(`git check-ignore "${file}"`, { cwd: folder.uri.fsPath });
          // If check-ignore succeeds, file IS ignored, so skip it
          console.log(`Ignoring: ${file}`);
        } catch {
          // If check-ignore fails, file is NOT ignored, so include it
          filteredFiles.push(file);
        }
      }
      
      return filteredFiles.sort();
    } catch (error) {
      console.error('Git command failed, falling back to VSCode API:', error);
      return this.fallbackFileList();
    }
  }

  private async fallbackFileList(): Promise<string[]> {
    // Your current implementation as fallback
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return [];
    
    const exts = vscode.workspace.getConfiguration('sorcery')
      .get<string[]>('includeFileExtensions') || [];
    const includeGlob = `**/*{${exts.join(',')}}`;
    const excludeGlob = `.sorcery/**`;
    
    const uris = await vscode.workspace.findFiles(includeGlob, excludeGlob);
    return uris
      .map(u => path.relative(folder.uri.fsPath, u.fsPath))
      .sort();
  }

  private async updateFileList(panel: vscode.WebviewPanel) {
    // Build the file paths array
    const filePaths = await this.getFilteredFilePaths();
    // Build a separate string of <li> items
    const listItems = filePaths.map(p => `<li>${p}</li>`).join('\n');

    // Post both the raw array and the HTML fragment
    panel.webview.postMessage({
      command: 'loadFiles',
      filePaths,
      listItems
    });
  }

  private getHtml(webview: vscode.Webview): string {
    // Extract sidebar HTML into a separate variable for clarity
    const sidebarHtml = `
      <div id="sidebar">
        <h2>Files</h2>
        <ul id="filesList"></ul>
      </div>
    `;

    // Main HTML template
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <style>
          body { margin: 0; padding: 0; height: 100vh; display: flex; font-family: sans-serif; }
          #main { flex: 1; padding: 10px; }
          #sidebar { width: 250px; border-left: 1px solid #ddd; padding: 10px; box-sizing: border-box; }
          #sidebar h2 { margin-top: 0; font-size: 1.2em; }
          #filesList { list-style: none; padding-left: 0; }
          #filesList li { padding: 4px 0; }
        </style>
      </head>
      <body>
        <div id="main">
          <h1>Custom Editor Test</h1>
          <p>Main editor area.</p>
        </div>
        ${sidebarHtml}
        <script nonce="${Date.now().toString()}">
          const vscode = acquireVsCodeApi();
          window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.command === 'loadFiles') {
              // msg.filePaths is the raw array, msg.listItems is the HTML fragment
              document.getElementById('filesList').innerHTML = msg.listItems;
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}
