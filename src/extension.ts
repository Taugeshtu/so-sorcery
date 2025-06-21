import * as path from 'path';
import * as vscode from 'vscode';
import { SorceryEditorProvider } from './SorceryEditorProvider';

export function activate(ctx: vscode.ExtensionContext) {
  ctx.subscriptions.push(
    vscode.commands.registerCommand('sorcery.newContext', async () => {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) { return vscode.window.showErrorMessage('Open a folder first.'); }

      // 1. .sorcery folder
      const folderUri = ws.uri.with({ path: path.posix.join(ws.uri.path, '.sorcery') });
      await vscode.workspace.fs.createDirectory(folderUri);

      // 2. New file name
      const fileName = await vscode.window.showInputBox({ prompt: 'File name, no extension' });
      if (!fileName) { return; }

      const fileUri = folderUri.with({ path: folderUri.path + `/${fileName}.sorcery` });
      // 3. Write starter content
      const starter = Buffer.from(JSON.stringify({ files: [], notes: '' }, null, 2));
      await vscode.workspace.fs.writeFile(fileUri, starter);

      // 4. Open with our custom editor
      await vscode.commands.executeCommand(
        'vscode.openWith',
        fileUri,
        SorceryEditorProvider.viewType
      );
    })
  );

  // 5. Register your custom editor
  const provider = new SorceryEditorProvider(ctx);
  ctx.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      SorceryEditorProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
}
