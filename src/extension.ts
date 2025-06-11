import * as vscode from 'vscode';
import simpleGit, { SimpleGit } from 'simple-git';
import * as path from 'path';

let syncInterval: NodeJS.Timeout | undefined;
let git: SimpleGit;
let statusBarItem: vscode.StatusBarItem | undefined;
let commitTimers: Map<string, NodeJS.Timeout> = new Map();

function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
}

function setStatusBarWorking(working: boolean) {
  if (!statusBarItem) return;
  const config = vscode.workspace.getConfiguration('vscode-autoGit');
  const showStatusBar = config.get<boolean>('statusBar', true);
  if (!showStatusBar) {
    statusBarItem.hide();
    return;
  }
  if (working) {
    statusBarItem.text = '$(sync~spin) AutoGit: Working...';
    statusBarItem.tooltip = 'Auto Git is performing an operation';
  } else {
    const enabled = config.get<boolean>('enabled', false);
    statusBarItem.text = enabled ? '$(git-commit) AutoGit: On' : '$(git-commit) AutoGit: Off';
    statusBarItem.tooltip = enabled ? 'Auto Git is enabled' : 'Auto Git is disabled';
    statusBarItem.show();
  }
}

async function getAICommitMessage(document: vscode.TextDocument): Promise<string | undefined> {
  try {
    if ((vscode as any).lm && typeof (vscode as any).lm.selectChatModels === 'function') {
      let models = await (vscode as any).lm.selectChatModels({ vendor: 'copilot' });
      if (!models || models.length === 0) {
        models = await (vscode as any).lm.selectChatModels({});
      }
      if (models && models.length > 0) {
        const model = models[0];
        const fileName = document.fileName;
        const fileContent = document.getText();
        const prompt = `Write a concise, conventional commit message for the following file change. File: ${fileName}\n\nContent:\n${fileContent}\n\nRespond with only the commit message.`;
        let messages;
        if (vscode?.LanguageModelChatMessage?.User) {
          messages = [vscode.LanguageModelChatMessage.User(prompt)];
        } else {
          messages = [{ role: 'user', content: prompt }];
        }
        const response = await model.sendRequest(messages, {});
        if (response && response.choices && response.choices.length > 0) {
          const msg = response.choices[0].message?.content || response.choices[0].content;
          if (msg && typeof msg === 'string') {
            return msg.trim();
          }
        } else if (response && response.text && typeof response.text === 'string') {
          return response.text.trim();
        } else if (response && response.stream && typeof response.stream === 'string') {
          return response.stream.trim();
        }
      }
    }
  } catch (err) {
    // Silently ignore errors and fallback to generic message
  }
  return undefined;
}

async function autoCommit(document: vscode.TextDocument) {
  const config = vscode.workspace.getConfiguration('vscode-autoGit');
  const enabled = config.get<boolean>('enabled', false);
  if (!enabled) return;
  setStatusBarWorking(true);
  const root = getWorkspaceRoot();
  if (!root) {
    setStatusBarWorking(false);
    return;
  }
  git = simpleGit(root);
  try {
    await git.add(document.fileName);
    let commitMessage = await getAICommitMessage(document);
    console.log('[AutoGit] Commit message to be used:', commitMessage);
    if (!commitMessage) {
      commitMessage = `Auto-commit: ${path.basename(document.fileName)} saved at ${new Date().toLocaleString()}`;
    }
    await git.commit(commitMessage);
    const syncAfterCommit = config.get<boolean>('syncAfterCommit', false);
    if (syncAfterCommit) {
      await autoSync();
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Auto-commit failed: ${err}`);
  } finally {
    setStatusBarWorking(false);
  }
}

async function autoSync() {
  const config = vscode.workspace.getConfiguration('vscode-autoGit');
  const enabled = config.get<boolean>('enabled', false);
  if (!enabled) return;
  setStatusBarWorking(true);
  const root = getWorkspaceRoot();
  if (!root) {
    setStatusBarWorking(false);
    return;
  }
  git = simpleGit(root);
  try {
    const remotes = await git.getRemotes(true);
    if (remotes.length === 0) {
      vscode.window.setStatusBarMessage('Auto Git: No remote defined, skipping sync', 2000);
      return;
    }
    await git.pull();
    await git.push();
    vscode.window.setStatusBarMessage('Auto Git: Synced with remote', 2000);
  } catch (err) {
    vscode.window.showErrorMessage(`Auto-sync failed: ${err}`);
  } finally {
    setStatusBarWorking(false);
  }
}

function startSyncTimer(intervalMinutes: number) {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(autoSync, intervalMinutes * 60 * 1000);
}

function updateStatusBar(enabled: boolean, show: boolean) {
  if (!show) {
    if (statusBarItem) {
      statusBarItem.hide();
    }
    return;
  }
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'extension.autoGit';
  }
  statusBarItem.text = enabled ? '$(git-commit) AutoGit: On' : '$(git-commit) AutoGit: Off';
  statusBarItem.tooltip = enabled ? 'Auto Git is enabled' : 'Auto Git is disabled';
  statusBarItem.show();
}

function scheduleAutoCommit(document: vscode.TextDocument) {
  const filePath = document.fileName;
  if (commitTimers.has(filePath)) {
    clearTimeout(commitTimers.get(filePath)!);
  }
  commitTimers.set(
    filePath,
    setTimeout(() => {
      autoCommit(document);
      commitTimers.delete(filePath);
    }, 30000)
  );
}

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('vscode-autoGit');
  const interval = config.get<number>('syncInterval', 10);
  const syncOnStartup = config.get<boolean>('syncOnStartup', true);
  const enabled = config.get<boolean>('enabled', false);
  const showStatusBar = config.get<boolean>('statusBar', true);
  updateStatusBar(enabled, showStatusBar);
  startSyncTimer(interval);

  if (syncOnStartup && enabled) {
    autoSync();
  }

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(scheduleAutoCommit)
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
      const config = vscode.workspace.getConfiguration('vscode-autoGit');
      const enabled = config.get<boolean>('enabled', false);
      const showStatusBar = config.get<boolean>('statusBar', true);
      updateStatusBar(enabled, showStatusBar);
      if (e.affectsConfiguration('vscode-autoGit.syncInterval')) {
        const newInterval = config.get<number>('syncInterval', 10);
        startSyncTimer(newInterval);
      }
    })
  );
}

export function deactivate() {
  if (syncInterval) clearInterval(syncInterval);
}
