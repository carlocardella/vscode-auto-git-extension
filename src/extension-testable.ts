/**
 * Test-friendly wrapper for extension functions.
 * This file exposes internal functions for unit testing purposes.
 */

import * as vscode from "vscode";
import simpleGit, { SimpleGit } from "simple-git";

// Re-export main extension functions
export { activate, deactivate } from './extension';

// Testable versions of internal functions
export class ExtensionTestHelper {
    private git: SimpleGit;
    
    constructor(workspaceRoot: string) {
        this.git = simpleGit(workspaceRoot);
    }

    /**
     * Test version of autoSync that can be called independently
     */
    async testAutoSync(): Promise<{ success: boolean; reason?: string; skipped?: boolean }> {
        const config = vscode.workspace.getConfiguration("vscode-autoGit");
        const enabled = config.get<boolean>("enabled", false);
        
        if (!enabled) {
            return { success: false, reason: "extension disabled" };
        }

        try {
            // Safety check: ensure no uncommitted changes before syncing
            const status = await this.git.status();
            if (status.files.length > 0) {
                return { success: false, reason: "uncommitted changes", skipped: true };
            }

            const remotes = await this.git.getRemotes(true);
            if (remotes.length === 0) {
                return { success: false, reason: "no remote" };
            }

            await this.git.pull();
            await this.git.push();
            return { success: true };
        } catch (err) {
            return { success: false, reason: err instanceof Error ? err.message : String(err) };
        }
    }

    /**
     * Test version of commitAndSync
     */
    async testCommitAndSync(): Promise<{ success: boolean; committed: boolean; synced: boolean; reason?: string }> {
        const config = vscode.workspace.getConfiguration("vscode-autoGit");
        const enabled = config.get<boolean>("enabled", false);
        
        if (!enabled) {
            return { success: false, committed: false, synced: false, reason: "extension disabled" };
        }

        let committed = false;
        let synced = false;

        try {
            // Stage and commit all pending changes before syncing
            await this.git.add("-A");
            const status = await this.git.status();
            
            if (status.staged.length > 0) {
                const commitMessage = `Test commit: All changes at ${new Date().toLocaleString()}`;
                await this.git.commit(commitMessage);
                committed = true;
            }

            const remotes = await this.git.getRemotes(true);
            if (remotes.length === 0) {
                return { success: true, committed, synced: false, reason: "no remote" };
            }

            await this.git.pull();
            await this.git.push();
            synced = true;

            return { success: true, committed, synced };
        } catch (err) {
            return { 
                success: false, 
                committed, 
                synced, 
                reason: err instanceof Error ? err.message : String(err) 
            };
        }
    }

    /**
     * Test commit message generation
     */
    async testGenerateCommitMessage(statusOutput: string): Promise<{ message: string; isAI: boolean }> {
        // Simple fallback version for testing
        const lines = statusOutput.trim().split("\n").filter(line => line.trim());
        const changedFiles = lines.map(line => {
            const filename = line.substring(3);
            return filename;
        });

        if (changedFiles.length === 0) {
            return { message: "Auto-commit: Update files", isAI: false };
        }

        const fileList = changedFiles.join(', ');
        const now = new Date().toLocaleString();
        return { message: `Auto-commit: ${fileList} at ${now}`, isAI: false };
    }

    /**
     * Get current git status for testing
     */
    async getGitStatus() {
        return await this.git.status();
    }

    /**
     * Test if workspace has git repository
     */
    async isGitRepository(): Promise<boolean> {
        try {
            await this.git.status();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Test helper to create test commits
     */
    async createTestCommit(message: string): Promise<void> {
        await this.git.add("-A");
        await this.git.commit(message);
    }

    /**
     * Test helper to check remotes
     */
    async hasRemotes(): Promise<boolean> {
        const remotes = await this.git.getRemotes(true);
        return remotes.length > 0;
    }
}

/**
 * Factory function for creating test helpers
 */
export function createTestHelper(workspaceRoot?: string): ExtensionTestHelper | null {
    const folders = vscode.workspace.workspaceFolders;
    const root = workspaceRoot || (folders && folders.length > 0 ? folders[0].uri.fsPath : undefined);
    
    if (!root) {
        return null;
    }

    return new ExtensionTestHelper(root);
}
