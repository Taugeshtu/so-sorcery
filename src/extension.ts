import * as path from 'path';
import * as vscode from 'vscode';
import { SorceryEditorProvider } from './SorceryEditorProvider';
import * as psyche from './psyche'
import { toolRegistry } from './tools/ToolRegistry';
import { MultiReadTool } from './tools/MultiReadTool';
import { FileReadTool } from './tools/FileReadTool';
import { getSessionCost } from './llm/models';

let sorceryEditorProvider: SorceryEditorProvider;
let costStatusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
  const lifetimeCost = context.globalState.get<number>('sorcery.lifetimeCost', 0);
  await psyche.initializePsyches(context.extensionUri);
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
  
  context.subscriptions.push(
    vscode.commands.registerCommand('sorcery.newContext', async () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0];
      if (!wsFolder) {
        return vscode.window.showErrorMessage('Please open a folder first.');
      }

      const sorceryDir = vscode.Uri.joinPath(wsFolder.uri, '.sorcery');
      await vscode.workspace.fs.createDirectory(sorceryDir);

      const existing = await vscode.workspace.findFiles('.sorcery/*.sorcery');
      const sessionNum = existing.length + 1;
      const fileName = `Session_${sessionNum}.sorcery`;
      const fileUri = vscode.Uri.joinPath(sorceryDir, fileName);

      const initial = JSON.stringify({ chat: '' }, null, 2);
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(initial, 'utf8'));

      await vscode.commands.executeCommand(
        'vscode.openWith',
        fileUri,
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
