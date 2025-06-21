import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';
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
      // Find all git repos (main + subrepos)
      const gitRepos = await this.findAllGitRepos(folder.uri.fsPath);
      console.log('Found git repos:', gitRepos);
      
      const allFiles: string[] = [];
      
      // Get files from each git repo
      for (const repoPath of gitRepos) {
        const repoFiles = await this.getGitFilesFromRepo(repoPath, exts, folder.uri.fsPath);
        allFiles.push(...repoFiles);
      }
      
      return [...new Set(allFiles)].sort(); // Remove duplicates and sort
    } catch (error) {
      console.error('Git repo discovery failed, falling back:', error);
      return this.fallbackFileList();
    }
  }

  private async findAllGitRepos(rootPath: string): Promise<string[]> {
    try {
      let findCommand: string;
      if (process.platform === 'win32') {
        // Windows version using dir command
        findCommand = `dir /s /b /a:d .git & dir /s /b /a:-d .git`;
      } else {
        // Unix version
        findCommand = `find . -name ".git" -type d -o -name ".git" -type f`;
      }
      
      const { stdout } = await execAsync(findCommand, { cwd: rootPath });
      
      const gitPaths = stdout.trim().split(/\r?\n/).filter(p => p);
      const repoPaths: string[] = [];
      
      for (const gitPath of gitPaths) {
        const repoPath = process.platform === 'win32' 
          ? path.dirname(gitPath)  // Windows gives full path
          : path.dirname(path.resolve(rootPath, gitPath)); // Unix gives relative
        
        repoPaths.push(repoPath);
      }
      
      return [...new Set(repoPaths)]; // Remove duplicates
    } catch (error) {
      console.warn('Git repo discovery failed, checking root only:', error);
      return [rootPath];
    }
  }

  private async getGitFilesFromRepo(repoPath: string, exts: string[], workspaceRoot: string): Promise<string[]> {
    try {
      // Get all tracked files from this specific repo
      const extPattern = exts.map(e => e.replace('.', '')).join('|');
      const { stdout } = await execAsync(
        `git ls-files | grep -E "\\.(${extPattern})$"`,
        { cwd: repoPath }
      );
      
      const files = stdout.trim().split('\n').filter(f => f);
      
      // Convert to paths relative to workspace root
      return files.map(file => {
        const fullPath = path.resolve(repoPath, file);
        return path.relative(workspaceRoot, fullPath);
      });
    } catch (error) {
      console.warn(`Failed to get files from repo ${repoPath}:`, error);
      return [];
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
