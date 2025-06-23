import * as vscode from 'vscode';

export function getWebviewHtml(webview: vscode.Webview, cssUri: vscode.Uri, jsUri: vscode.Uri): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="${cssUri}">
    </head>
    <body>
      <div id="main">
        <div id="knowledgesList"></div>
      </div>
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
        <div class="context-files-section">
          <h2 class="files-header">Files in Context</h2>
          <ul id="contextFilesList"></ul>
        </div>
      </div>
      <script src="${jsUri}"></script>
    </body>
    </html>
  `;
}