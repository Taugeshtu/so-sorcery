// src/webview/htmlTemplate.ts
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
      <div id="container">
        <div id="main">
          <div id="knowledgesList"></div>
          
          <div id="inputSection">
            <div id="textareaContainer">
              <div id="lineNumbers"></div>
              <textarea 
                id="userInput" 
                placeholder="Add your knowledge here..."
                rows="6"
              ></textarea>
            </div>
            <div id="buttonContainer">
              <button id="addButton" class="secondary-button">Add Knowledge</button>
              <button id="addRunButton" class="primary-button">Add & Run Agent</button>
            </div>
          </div>
        </div>
        <div id="resizer"></div>
        <div id="sidebar">
          <div class="included-files-section">
            <h3>Included Files</h3>
            <ul id="includedFilesList"></ul>
          </div>
          
          <div class="search-section">
            <input type="text" id="fileSearchInput" placeholder="Search files..." />
          </div>
          
          <div class="available-files-section">
            <h3>Available Files</h3>
            <div id="availableFilesTree"></div>
          </div>
        </div>
      </div>
      <script src="${jsUri}"></script>
    </body>
    </html>
  `;
}
