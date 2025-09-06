import 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';

// Simple tests to verify test infrastructure
describe('Extension Basic Tests', () => {
  
  it('should load VS Code APIs', () => {
    assert.ok(vscode);
    assert.ok(vscode.workspace);
    assert.ok(vscode.window);
  });

  it('should have basic configuration access', () => {
    const config = vscode.workspace.getConfiguration('vscode-autoGit');
    assert.ok(config);
    // Just check that we can call get without error
    const enabled = config.get('enabled');
    assert.ok(enabled !== undefined);
  });

  it('should detect registered commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(Array.isArray(commands));
    assert.ok(commands.length > 0);
  });

});
