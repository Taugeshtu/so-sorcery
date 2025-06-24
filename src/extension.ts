import * as path from 'path';
import * as vscode from 'vscode';
import { SorceryEditorProvider } from './SorceryEditorProvider';
import * as psyche from './psyche'

export function activate(context: vscode.ExtensionContext) {
  psyche.initializePsyches(context.extensionUri);
  
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

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      SorceryEditorProvider.viewType,
      new SorceryEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true
      }
    )
  );
}