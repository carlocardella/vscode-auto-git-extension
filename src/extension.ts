import * as vscode from 'vscode';
import simpleGit, { SimpleGit } from 'simple-git';
import * as path from 'path';

let syncInterval: NodeJS.Timeout | undefined;
let git: SimpleGit;

function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
}

async function autoCommit(document: vscode.TextDocument) {
  const root = getWorkspaceRoot();
  if (!root) return;
  git = simpleGit(root);
  try {
    await git.add(document.fileName);
    await git.commit(`Auto-commit: ${path.basename(document.fileName)} saved at ${new Date().toLocaleString()}`);
    const config = vscode.workspace.getConfiguration('vscode-autogit');
    const syncAfterCommit = config.get<boolean>('syncAfterCommit', false);
    if (syncAfterCommit) {
      await autoSync();
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Auto-commit failed: ${err}`);
  }
}

async function autoSync() {
  const root = getWorkspaceRoot();
  if (!root) return;
  git = simpleGit(root);
  try {
    await git.pull();
    await git.push();
    vscode.window.setStatusBarMessage('Auto Git: Synced with remote', 2000);
  } catch (err) {
    vscode.window.showErrorMessage(`Auto-sync failed: ${err}`);
  }
}

function startSyncTimer(intervalMinutes: number) {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(autoSync, intervalMinutes * 60 * 1000);
}

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('vscode-autogit');
  const interval = config.get<number>('syncInterval', 10);
  const syncOnStartup = config.get<boolean>('syncOnStartup', true);
  startSyncTimer(interval);

  if (syncOnStartup) {
    autoSync();
  }

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(autoCommit),
    vscode.commands.registerCommand('extension.autogit', () => {
      vscode.window.showInformationMessage('Auto Git extension is now active!');
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
      if (e.affectsConfiguration('vscode-autogit.syncInterval')) {
        const newInterval = vscode.workspace.getConfiguration('vscode-autogit').get<number>('syncInterval', 10);
        startSyncTimer(newInterval);
      }
    })
  );
}

export function deactivate() {
  if (syncInterval) clearInterval(syncInterval);
}
