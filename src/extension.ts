import * as path from 'path';
import * as vscode from 'vscode';
import { SorceryEditorProvider } from './SorceryEditorProvider';
import { psycheRegistry } from './psyche';
import { toolRegistry } from './tools/ToolRegistry';
import { MultiReadTool } from './tools/MultiReadTool';
import { FileReadTool } from './tools/FileReadTool';
import { getSessionCost } from './llm/models';

let sorceryEditorProvider: SorceryEditorProvider;
let costStatusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
  const lifetimeCost = context.globalState.get<number>('sorcery.lifetimeCost', 0);
  await psycheRegistry.initialize(context.extensionUri);
  toolRegistry.register(MultiReadTool);
  // toolRegistry.register(FileReadTool); // file read tool is disabled, this is future stuff
  
  // Create status bar item
  costStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  costStatusBarItem.tooltip = 'Sorcery cost tracking - workspace total and session increment';
  context.subscriptions.push(costStatusBarItem);
  
  // Update cost display initially and periodically
  updateCostDisplay();
  const costUpdateInterval = setInterval(updateCostDisplay, 2000); // Update every 2 seconds
  context.subscriptions.push(new vscode.Disposable(() => clearInterval(costUpdateInterval)));
  
  // Context-sensitive Alt+S command
  context.subscriptions.push(
    vscode.commands.registerCommand('sorcery.addAndRun', async () => {
      const focusedPanel = sorceryEditorProvider.getCurrentlyFocusedPanel();
      if (focusedPanel) {
        focusedPanel.webview.postMessage({ command: 'executeAddAndRun' });
      }
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('sorcery.addKnowledge', async () => {
      const focusedPanel = sorceryEditorProvider.getCurrentlyFocusedPanel();
      if (focusedPanel) {
        focusedPanel.webview.postMessage({ command: 'executeAddKnowledge' });
      }
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('sorcery.newSession', async () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0];
      if (!wsFolder) {
        return vscode.window.showErrorMessage('Please open a folder first.');
      }
      
      const sorceryDir = vscode.Uri.joinPath(wsFolder.uri, '.sorcery');
      await vscode.workspace.fs.createDirectory(sorceryDir);
      
      const fileName = await pickNewSessionName(sorceryDir);
      const fileUri = vscode.Uri.joinPath(sorceryDir, fileName+'.sorcery');
      
      const initial = JSON.stringify({ chat: '' }, null, 2);
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(initial, 'utf8'));
      
      await vscode.commands.executeCommand(
        'vscode.openWith',
        fileUri,
        SorceryEditorProvider.viewType
      );
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('sorcery.forkSession', async () => {
      const focusedPanel = sorceryEditorProvider.getCurrentlyFocusedPanel();
      if (!focusedPanel) {
        return vscode.window.showErrorMessage('No active Sorcery session to fork.');
      }
      
      const currentUri = sorceryEditorProvider.getCurrentDocumentUri();
      if (!currentUri) {
        return vscode.window.showErrorMessage('Cannot determine current session file.');
      }
      const wsFolder = vscode.workspace.workspaceFolders?.[0];
      if (!wsFolder) {
        return vscode.window.showErrorMessage('Please open a folder first.');
      }
      
      // Extract base name without extension
      const parentDir = vscode.Uri.file(path.dirname(currentUri.fsPath));
      const currentBaseName = path.basename(currentUri.fsPath, '.sorcery');
      const forkName = await pickForkName(parentDir, currentBaseName);
      
      // Read current session content and clone it
      const currentContent = await vscode.workspace.fs.readFile(currentUri);
      const forkUri = vscode.Uri.joinPath(parentDir, forkName + '.sorcery');
      await vscode.workspace.fs.writeFile(forkUri, currentContent);
      
      // Open the forked session
      await vscode.commands.executeCommand(
        'vscode.openWith',
        forkUri,
        SorceryEditorProvider.viewType
      );
    })
  );

  // Create and store reference to SorceryEditorProvider
  sorceryEditorProvider = new SorceryEditorProvider(context);
  
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      SorceryEditorProvider.viewType,
      sorceryEditorProvider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true
      }
    )
  );
}

function updateCostDisplay() {
  const sessionCost = getSessionCost();
  const workspaceCost = sorceryEditorProvider ? sorceryEditorProvider.getWorkspaceCost() : 0;
  const formatCost = (cost: number): string => {
    return cost.toFixed(2);
  };
  
  const workspaceCostStr = formatCost(workspaceCost);
  const sessionCostStr = formatCost(sessionCost);
  
  costStatusBarItem.text = `💰 Sorcery: ${workspaceCostStr} (+${sessionCostStr})`;
  costStatusBarItem.show();
}

async function pickNewSessionName(placementDir: vscode.Uri): Promise<string> {
  const entries = await vscode.workspace.fs.readDirectory(placementDir);
  const sessionFiles = entries
    .filter(([name, type]) => 
      type === vscode.FileType.File && 
      name.endsWith('.sorcery') && 
      path.basename(name, '.sorcery').startsWith('Session_')
    )
    .map(([name]) => vscode.Uri.joinPath(placementDir, name));
  
  let nextSessionNum = 1;
  if (sessionFiles.length > 0) {
    const sessionNumbers = sessionFiles
      .map(uri => {
        const fileName = path.basename(uri.fsPath, '.sorcery');
        const match = fileName.match(/^Session_(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0);
    
    if (sessionNumbers.length > 0) {
      nextSessionNum = Math.max(...sessionNumbers) + 1;
    }
  }
  return `Session_${nextSessionNum}`;
}

async function pickForkName(placementDir: vscode.Uri, parentName: string): Promise<string> {
  // Generate fork name with letter suffix
  let forkName: string = '';
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const randomOffset = Math.floor(Math.random() * 26);
  
  let found = false;
  for (let i = 0; i < 26; i++) {
    const letterIndex = (randomOffset + i) % 26;
    const testName = parentName + alphabet[letterIndex];
    const testUri = vscode.Uri.joinPath(placementDir, testName + '.sorcery');
    
    try {
      await vscode.workspace.fs.stat(testUri);
      // File exists, try next letter
    } catch {
      // File doesn't exist, use this name
      forkName = testName;
      found = true;
      break;
    }
  }
  
  // Fallback to numeric naming if all letters taken
  if (!found) {
    return pickNewSessionName( placementDir );
  }
  return forkName;
}
