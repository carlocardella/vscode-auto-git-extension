import 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';

describe('VSCode autoGit Extension', () => {
  it('should have the correct configuration defaults', () => {
    const config = vscode.workspace.getConfiguration('vscode-autoGit');
    assert.strictEqual(config.get('enabled'), false);
    assert.strictEqual(config.get('syncInterval'), 10);
    assert.strictEqual(config.get('syncOnStartup'), true);
    assert.strictEqual(config.get('syncAfterCommit'), false);
    assert.strictEqual(config.get('statusBar'), true);
  });

  it('should register the autoGit command', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('extension.autoGit'));
  });

  // More tests can be added for logic, but git operations should be mocked in CI/local
});
