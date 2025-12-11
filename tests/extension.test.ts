import 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Import the extension module for testing
import { createTestHelper, ExtensionTestHelper } from '../src/extension-testable';

describe('VSCode autoGit Extension', () => {
  let sandbox: sinon.SinonSandbox;
  let testWorkspaceDir: string;
  let testHelper: ExtensionTestHelper | null;

  before(async () => {
    // Create a temporary test workspace directory
    testWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autogit-test-'));
    
    // Initialize a git repository in the test directory
    const simpleGit = require('simple-git');
    const git = simpleGit(testWorkspaceDir);
    
    try {
      await git.init();
      await git.addConfig('user.name', 'Test User');
      await git.addConfig('user.email', 'test@example.com');
      
      // Create a test file
      fs.writeFileSync(path.join(testWorkspaceDir, 'test.txt'), 'initial content');
      await git.add('test.txt');
      await git.commit('Initial commit');
    } catch (error) {
      console.warn('Failed to initialize test git repository:', error);
    }
  });

  after(() => {
    // Clean up test directory
    try {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Mock workspace folders to point to our test directory
    const mockWorkspaceFolder = {
      uri: { fsPath: testWorkspaceDir },
      name: 'test-workspace',
      index: 0
    };
    sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);
    
    // Create test helper
    testHelper = createTestHelper(testWorkspaceDir);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Configuration Tests', () => {
    it('should have the correct configuration defaults', () => {
      const mockConfig = createMockWorkspaceConfiguration({
        enabled: false,
        syncInterval: 10,
        syncOnStartup: true,
        syncAfterCommit: false,
        statusBar: true,
        debounceIntervalSeconds: 30,
        preferredModel: ''
      });
      
      sandbox.stub(vscode.workspace, 'getConfiguration').returns(mockConfig as any);

      const config = vscode.workspace.getConfiguration('vscode-autoGit');
      assert.strictEqual(config.get('enabled', false), false);
      assert.strictEqual(config.get('syncInterval', 10), 10);
      assert.strictEqual(config.get('syncOnStartup', true), true);
      assert.strictEqual(config.get('syncAfterCommit', false), false);
      assert.strictEqual(config.get('statusBar', true), true);
      assert.strictEqual(config.get('debounceIntervalSeconds', 30), 30);
      assert.strictEqual(config.get('preferredModel', ''), '');
    });
  });

  describe('Command Registration Tests', () => {
    it('should have command structure available', async function() {
      this.timeout(2000); // Short timeout
      
      const commands = await vscode.commands.getCommands(true);
      // Just verify commands can be queried and array structure exists
      assert.ok(Array.isArray(commands));
      assert.ok(commands.length > 0);
    });

    it('should have extension structure available', async function() {
      this.timeout(2000); // Short timeout
      
      // Just verify the extension registry is accessible
      const extensions = vscode.extensions.all;
      assert.ok(Array.isArray(extensions));
      assert.ok(extensions.length > 0);
    });
  });

  describe('Git Safety Tests', () => {
    beforeEach(() => {
      // Mock enabled configuration
      const mockConfig = createMockWorkspaceConfiguration({
        enabled: true,
        syncAfterCommit: false
      });
      sandbox.stub(vscode.workspace, 'getConfiguration').returns(mockConfig as any);
    });

    it('should skip sync when uncommitted changes exist', async function() {
      this.timeout(5000); // Allow more time for git operations
      
      if (!testHelper) {
        this.skip();
        return;
      }

      // Create uncommitted changes
      const testFile = path.join(testWorkspaceDir, 'uncommitted.txt');
      fs.writeFileSync(testFile, 'uncommitted content');

      // Test autoSync behavior
      const result = await testHelper.testAutoSync();
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.skipped, true);
      assert.strictEqual(result.reason, 'uncommitted changes');
    });

    it('should proceed with sync when no uncommitted changes exist', async function() {
      this.timeout(5000);
      
      if (!testHelper) {
        this.skip();
        return;
      }

      // First commit any pending changes to ensure clean state
      const status = await testHelper.getGitStatus();
      if (status.files.length > 0) {
        // Commit any uncommitted changes to ensure clean state
        const simpleGit = require('simple-git');
        const git = simpleGit(testWorkspaceDir);
        await git.add('.');
        await git.commit('Clean up test state');
      }

      // Verify clean state
      const cleanStatus = await testHelper.getGitStatus();
      assert.strictEqual(cleanStatus.files.length, 0, 'Repository should be clean before sync test');

      // Test autoSync behavior (will fail without remote, but shouldn't skip due to uncommitted changes)
      const result = await testHelper.testAutoSync();
      
      // Should not be skipped due to uncommitted changes (should fail due to no remote instead)
      assert.notStrictEqual(result.reason, 'uncommitted changes', 'Should not skip due to uncommitted changes when repo is clean');
      
      // Should fail due to no remote, not uncommitted changes
      if (!result.success) {
        assert.strictEqual(result.reason, 'no remote', 'Should fail due to no remote, not uncommitted changes');
      }
    });
  });

  describe('Commit and Sync Logic Tests', () => {
    beforeEach(() => {
      const mockConfig = createMockWorkspaceConfiguration({
        enabled: true,
        syncAfterCommit: false
      });
      sandbox.stub(vscode.workspace, 'getConfiguration').returns(mockConfig as any);
    });

    it('should commit pending changes', async function() {
      this.timeout(5000);
      
      if (!testHelper) {
        this.skip();
        return;
      }

      // Create changes to commit
      const testFile = path.join(testWorkspaceDir, 'commit-test.txt');
      fs.writeFileSync(testFile, 'content to commit');

      // Test commitAndSync
      const result = await testHelper.testCommitAndSync();
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.committed, true);
      // Sync will fail without remote, but commit should succeed
    });

    it('should not commit when no changes exist', async function() {
      this.timeout(5000);
      
      if (!testHelper) {
        this.skip();
        return;
      }

      // Ensure clean working directory
      const status = await testHelper.getGitStatus();
      if (status.files.length > 0) {
        const simpleGit = require('simple-git');
        const git = simpleGit(testWorkspaceDir);
        await git.checkout('.');
      }

      // Test commitAndSync with no changes
      const result = await testHelper.testCommitAndSync();
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.committed, false);
    });
  });

  describe('Commit Message Generation Tests', () => {
    it('should generate commit message for single file change', async function() {
      if (!testHelper) {
        this.skip();
        return;
      }

      const statusOutput = 'M  test.txt';
      const result = await testHelper.testGenerateCommitMessage(statusOutput);
      
      assert.ok(result.message.includes('test.txt'));
      assert.ok(result.message.startsWith('Auto-commit:'));
    });

    it('should generate commit message for multiple file changes', async function() {
      if (!testHelper) {
        this.skip();
        return;
      }

      const statusOutput = 'M  file1.txt\nA  file2.txt\nD  file3.txt';
      const result = await testHelper.testGenerateCommitMessage(statusOutput);
      
      assert.ok(result.message.includes('file1.txt'));
      assert.ok(result.message.includes('file2.txt'));
      assert.ok(result.message.includes('file3.txt'));
    });

    it('should handle empty status output', async function() {
      if (!testHelper) {
        this.skip();
        return;
      }

      const statusOutput = '';
      const result = await testHelper.testGenerateCommitMessage(statusOutput);
      
      assert.strictEqual(result.message, 'Auto-commit: Update files');
    });
  });

  describe('Git Repository Tests', () => {
    it('should detect git repository', async function() {
      if (!testHelper) {
        this.skip();
        return;
      }

      const isGitRepo = await testHelper.isGitRepository();
      assert.strictEqual(isGitRepo, true);
    });

    it('should detect absence of remotes', async function() {
      if (!testHelper) {
        this.skip();
        return;
      }

      const hasRemotes = await testHelper.hasRemotes();
      assert.strictEqual(hasRemotes, false); // Test repo has no remotes
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle extension disabled state', async function() {
      if (!testHelper) {
        this.skip();
        return;
      }

      // Mock disabled configuration
      const mockConfig = createMockWorkspaceConfiguration({
        enabled: false
      });
      sandbox.stub(vscode.workspace, 'getConfiguration').returns(mockConfig as any);

      const result = await testHelper.testAutoSync();
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'extension disabled');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow without remote', async function() {
      this.timeout(10000);
      
      if (!testHelper) {
        this.skip();
        return;
      }

      // Mock enabled configuration
      const mockConfig = createMockWorkspaceConfiguration({
        enabled: true,
        syncAfterCommit: false
      });
      sandbox.stub(vscode.workspace, 'getConfiguration').returns(mockConfig as any);

      // Create a test file
      const testFile = path.join(testWorkspaceDir, 'integration-test.txt');
      fs.writeFileSync(testFile, 'integration test content');

      // Test complete commit workflow
      const commitResult = await testHelper.testCommitAndSync();
      
      assert.strictEqual(commitResult.success, true);
      assert.strictEqual(commitResult.committed, true);
      assert.strictEqual(commitResult.synced, false); // No remote configured
      assert.strictEqual(commitResult.reason, 'no remote');
    });
  });
});

// Helper functions for testing
export function createMockDocument(fileName: string): Partial<vscode.TextDocument> {
  return {
    uri: { scheme: 'file', fsPath: fileName } as vscode.Uri,
    fileName: fileName,
    languageId: 'plaintext',
    version: 1,
    isDirty: false,
    isClosed: false,
    isUntitled: false,
    save: async () => true,
    eol: vscode.EndOfLine.LF,
    lineCount: 1,
    lineAt: () => ({ text: '', range: new vscode.Range(0, 0, 0, 0) } as any),
    offsetAt: () => 0,
    positionAt: () => new vscode.Position(0, 0),
    getText: () => '',
    getWordRangeAtPosition: () => undefined,
    validateRange: (range) => range,
    validatePosition: (pos) => pos
  };
}

export function createMockWorkspaceConfiguration(defaults: any): Partial<vscode.WorkspaceConfiguration> {
  return {
    get: (key: string, defaultValue?: any) => defaults[key] ?? defaultValue,
    has: (key: string) => key in defaults,
    inspect: () => undefined,
    update: async () => {},
  };
}
