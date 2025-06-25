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
          
          <div id="workerOutput" class="hidden">
            <div id="workerOutputHeader">
              <h3 id="workerOutputTitle">Worker Output</h3>
              <button id="copyWorkerOutputButton" class="copy-button">Copy</button>
            </div>
            <div id="workerOutputContent"></div>
          </div>
          
          <div id="inputSection">
            <div id="buttonContainer">
              <div id="leftButtons">
                <button id="addButton" class="icon-button" title="Add Knowledge">+</button>
                <button id="runButton" class="primary-button">Run</button>
              </div>
              <div id="rightButtons">
                <div id="workerButtons">
                  <!-- Worker buttons will be dynamically added here -->
                </div>
              </div>
            </div>
            <div id="textareaContainer">
              <textarea 
                id="userInput" 
                placeholder="Add your knowledge here..."
                rows="8"
              ></textarea>
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
