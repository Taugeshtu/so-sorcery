import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';

interface GitIgnoreRule {
  pattern: string;
  isNegation: boolean;
  isDirectory: boolean;
  repoRoot: string;
}

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
    
    this.updateFileList(webviewPanel);
  }
  
  private async getFilteredFilePaths(): Promise<string[]> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return [];
    }

    const exts = vscode.workspace.getConfiguration('sorcery')
      .get<string[]>('includeFileExtensions') || [];
    
    try {
      // Find all .gitignore files and their repo roots
      const gitIgnoreRules = await this.loadAllGitIgnoreRules(folder.uri.fsPath);
      
      // Walk filesystem and apply filters
      const allFiles = await this.walkDirectory(
        folder.uri.fsPath, 
        folder.uri.fsPath, 
        exts, 
        gitIgnoreRules
      );
      
      return allFiles.sort();
    } catch (error) {
      console.error('File discovery failed:', error);
      return [];
    }
  }

  private async loadAllGitIgnoreRules(rootPath: string): Promise<GitIgnoreRule[]> {
    const rules: GitIgnoreRule[] = [];
    
    // Find all .gitignore files recursively
    const gitIgnoreFiles = await this.findGitIgnoreFiles(rootPath);
    
    for (const gitIgnoreFile of gitIgnoreFiles) {
      const repoRoot = path.dirname(gitIgnoreFile);
      const gitIgnoreRules = await this.parseGitIgnoreFile(gitIgnoreFile, repoRoot);
      rules.push(...gitIgnoreRules);
    }
    
    return rules;
  }

  private async findGitIgnoreFiles(rootPath: string): Promise<string[]> {
    const gitIgnoreFiles: string[] = [];
    
    const walkForGitIgnore = async (dirPath: string) => {
      try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            // Skip common non-repo directories to avoid deep recursion
            if (!['node_modules', '.git', 'build', 'dist', 'out'].includes(entry.name)) {
              await walkForGitIgnore(fullPath);
            }
          } else if (entry.name === '.gitignore') {
            gitIgnoreFiles.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
        console.warn(`Cannot read directory ${dirPath}:`, error);
      }
    };
    
    await walkForGitIgnore(rootPath);
    return gitIgnoreFiles;
  }

  private async parseGitIgnoreFile(gitIgnoreFile: string, repoRoot: string): Promise<GitIgnoreRule[]> {
    try {
      const content = await fs.promises.readFile(gitIgnoreFile, 'utf8');
      const rules: GitIgnoreRule[] = [];
      
      for (let line of content.split(/\r?\n/)) {
        line = line.trim();
        
        // Skip empty lines and comments
        if (!line || line.startsWith('#')) {
          continue;
        }
        
        const isNegation = line.startsWith('!');
        if (isNegation) {
          line = line.substring(1);
        }
        
        const isDirectory = line.endsWith('/');
        if (isDirectory) {
          line = line.substring(0, line.length - 1);
        }
        
        rules.push({
          pattern: line,
          isNegation,
          isDirectory,
          repoRoot
        });
      }
      
      return rules;
    } catch (error) {
      console.warn(`Failed to parse .gitignore file ${gitIgnoreFile}:`, error);
      return [];
    }
  }

  private async walkDirectory(
    dirPath: string, 
    workspaceRoot: string, 
    extensions: string[], 
    gitIgnoreRules: GitIgnoreRule[]
  ): Promise<string[]> {
    const files: string[] = [];
    
    const walkRecursive = async (currentPath: string) => {
      try {
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          const relativePath = path.relative(workspaceRoot, fullPath);
          
          // Skip .git directories entirely
          if (entry.name === '.git') {
            continue;
          }
          
          if (entry.isDirectory()) {
            // Check if directory should be ignored
            if (!this.isIgnored(relativePath + '/', gitIgnoreRules, workspaceRoot, true)) {
              await walkRecursive(fullPath);
            }
          } else if (entry.isFile()) {
            // Check file extension
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              // Check if file should be ignored
              if (!this.isIgnored(relativePath, gitIgnoreRules, workspaceRoot, false)) {
                files.push(relativePath);
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Cannot read directory ${currentPath}:`, error);
      }
    };
    
    await walkRecursive(dirPath);
    return files;
  }

  private isIgnored(
    filePath: string, 
    gitIgnoreRules: GitIgnoreRule[], 
    workspaceRoot: string,
    isDirectory: boolean
  ): boolean {
    let ignored = false;
    
    // Convert to forward slashes for consistent matching
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    for (const rule of gitIgnoreRules) {
      // Check if this rule applies to this file's location
      const fileFullPath = path.resolve(workspaceRoot, filePath);
      const ruleApplies = fileFullPath.startsWith(rule.repoRoot);
      
      if (!ruleApplies) {
        continue;
      }
      
      // Get path relative to this rule's repo root
      const pathFromRepoRoot = path.relative(rule.repoRoot, fileFullPath).replace(/\\/g, '/');
      
      if (this.matchesGitIgnorePattern(pathFromRepoRoot, rule.pattern, rule.isDirectory, isDirectory)) {
        if (rule.isNegation) {
          ignored = false; // Negation rules un-ignore
        } else {
          ignored = true;  // Normal rules ignore
        }
      }
    }
    
    return ignored;
  }

  private matchesGitIgnorePattern(filePath: string, pattern: string, ruleIsDirectory: boolean, fileIsDirectory: boolean): boolean {
    // If rule is for directories only, but file is not a directory, no match
    if (ruleIsDirectory && !fileIsDirectory) {
      return false;
    }
    
    // Convert gitignore pattern to regex-like matching
    // This is a simplified version - full gitignore matching is quite complex
    
    // Handle absolute patterns (starting with /)
    if (pattern.startsWith('/')) {
      pattern = pattern.substring(1);
      // Match from root only
      return this.simpleGlobMatch(filePath, pattern);
    }
    
    // Handle patterns that should match anywhere in the path
    const pathParts = filePath.split('/');
    
    // Try matching the pattern against the full path
    if (this.simpleGlobMatch(filePath, pattern)) {
      return true;
    }
    
    // Try matching against each path segment and its trailing path
    for (let i = 0; i < pathParts.length; i++) {
      const subPath = pathParts.slice(i).join('/');
      if (this.simpleGlobMatch(subPath, pattern)) {
        return true;
      }
    }
    
    return false;
  }

  private simpleGlobMatch(text: string, pattern: string): boolean {
    // Convert glob pattern to regex
    // This is simplified - doesn't handle all gitignore edge cases
    const regexPattern = pattern
      .replace(/\./g, '\\.')  // Escape dots
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/\?/g, '[^/]')  // ? matches single char except /
      .replace(/\\\*\\\*/g, '.*'); // ** matches anything including /
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(text);
  }

  private async updateFileList(panel: vscode.WebviewPanel) {
    const filePaths = await this.getFilteredFilePaths();
    const listItems = filePaths.map(p => `<li>${p}</li>`).join('\n');

    panel.webview.postMessage({
      command: 'loadFiles',
      filePaths,
      listItems
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const sidebarHtml = `
      <div id="sidebar">
        <h2>Files</h2>
        <ul id="filesList"></ul>
      </div>
    `;

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
              document.getElementById('filesList').innerHTML = msg.listItems;
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}