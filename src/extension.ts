import * as vscode from "vscode";
import simpleGit, { SimpleGit } from "simple-git";
import * as path from "path";

let syncInterval: NodeJS.Timeout | undefined;
let git: SimpleGit;
let statusBarItem: vscode.StatusBarItem | undefined;
let commitTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Returns the root path of the current workspace, or undefined if not available.
 */
function getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
}

/**
 * Updates the status bar to reflect whether autoGit is working or idle.
 * @param working Whether autoGit is currently performing an operation.
 */
function setStatusBarWorking(working: boolean) {
    if (!statusBarItem) return;
    const config = vscode.workspace.getConfiguration("vscode-autoGit");
    const showStatusBar = config.get<boolean>("statusBar", true);
    if (!showStatusBar) {
        statusBarItem.hide();
        return;
    }
    if (working) {
        statusBarItem.text = "$(sync~spin) autoGit: Working...";
        statusBarItem.tooltip = "autoGit is performing an operation";
    } else {
        const enabled = config.get<boolean>("enabled", false);
        statusBarItem.text = enabled
            ? "$(git-commit) autoGit: On"
            : "$(git-commit) autoGit: Off";
        statusBarItem.tooltip = enabled
            ? "autoGit is enabled"
            : "autoGit is disabled";
        statusBarItem.show();
    }
}

/**
 * Stages all changes and commits them with an AI-generated or fallback message.
 * Optionally syncs with remote if configured.
 * @param document The VS Code text document that triggered the commit.
 */
async function autoCommit(document: vscode.TextDocument) {
    const config = vscode.workspace.getConfiguration("vscode-autoGit");
    const enabled = config.get<boolean>("enabled", false);
    if (!enabled) return;
    setStatusBarWorking(true);
    const root = getWorkspaceRoot();
    if (!root) {
        setStatusBarWorking(false);
        return;
    }
    git = simpleGit(root);
    try {
        // Stage all changes (add, delete, update, rename, etc.)
        await git.add("-A");
        // Try to generate AI commit message using generateCommitMessage
        let commitMessage: string | undefined;
        try {
            // Get git status for the repo (all changes)
            const porcelain = await git.raw([
                "status",
                "--porcelain"
            ]);
            commitMessage = await generateCommitMessage(porcelain);
        } catch (aiError) {
            // If AI fails, commitMessage will remain undefined
            console.warn(
                "autoGit: AI commit message generation failed:",
                aiError
            );
        }
        if (!commitMessage || !commitMessage.trim()) {
            commitMessage = `Auto-commit: All changes at ${new Date().toLocaleString()}`;
        }
        await git.commit(commitMessage);
        const syncAfterCommit = config.get<boolean>("syncAfterCommit", false);
        if (syncAfterCommit) {
            await autoSync();
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Auto-commit failed: ${err}`);
    } finally {
        setStatusBarWorking(false);
    }
}

/**
 * Stages and commits all pending changes, then pulls and pushes to remote if available.
 */
async function autoSync() {
    const config = vscode.workspace.getConfiguration("vscode-autoGit");
    const enabled = config.get<boolean>("enabled", false);
    if (!enabled) return;
    setStatusBarWorking(true);
    const root = getWorkspaceRoot();
    if (!root) {
        setStatusBarWorking(false);
        return;
    }
    git = simpleGit(root);
    try {
        // Stage and commit all pending changes before syncing
        await git.add("-A");
        const porcelain = await git.raw(["status", "--porcelain"]);
        let commitMessage = await generateCommitMessage(porcelain);
        if (!commitMessage || !commitMessage.trim()) {
            commitMessage = `Auto-commit: All changes at ${new Date().toLocaleString()}`;
        }
        // Only commit if there are staged changes
        const status = await git.status();
        if (status.staged.length > 0) {
            await git.commit(commitMessage);
        }
        const remotes = await git.getRemotes(true);
        if (remotes.length === 0) {
            vscode.window.setStatusBarMessage(
                "autoGit: No remote defined, skipping sync",
                2000
            );
            return;
        }
        await git.pull();
        await git.push();
        vscode.window.setStatusBarMessage("autoGit: Synced with remote", 2000);
    } catch (err) {
        vscode.window.showErrorMessage(`Auto-sync failed: ${err}`);
    } finally {
        setStatusBarWorking(false);
    }
}

/**
 * Starts or restarts the periodic sync timer with the given interval in minutes.
 * @param intervalMinutes The interval in minutes for periodic sync.
 */
function startSyncTimer(intervalMinutes: number) {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(autoSync, intervalMinutes * 60 * 1000);
}

/**
 * Toggles the autoGit enabled/disabled state in the workspace configuration.
 */
function toggleautoGitEnabled() {
    const config = vscode.workspace.getConfiguration("vscode-autoGit");
    const enabled = config.get<boolean>("enabled", false);
    config
        .update("enabled", !enabled, vscode.ConfigurationTarget.Workspace)
        .then(() => {
            const showStatusBar = config.get<boolean>("statusBar", true);
            updateStatusBar(!enabled, showStatusBar);
            vscode.window.showInformationMessage(
                `autoGit is now ${!enabled ? "enabled" : "disabled"}.`
            );
        });
}

/**
 * Manually commits and syncs changes on demand.
 * This function can be called regardless of the autoGit enabled state.
 */
async function manualCommitAndSync() {
    setStatusBarWorking(true);
    const root = getWorkspaceRoot();
    if (!root) {
        vscode.window.showErrorMessage("No workspace folder found");
        setStatusBarWorking(false);
        return;
    }

    git = simpleGit(root);
    
    try {
        // Check if there are any changes to commit
        await git.add("-A");
        const status = await git.status();
        
        if (status.staged.length === 0) {
            vscode.window.showInformationMessage("No changes to commit");
            setStatusBarWorking(false);
            return;
        }

        // Generate commit message
        const porcelain = await git.raw(["status", "--porcelain"]);
        let commitMessage = await generateCommitMessage(porcelain);
        if (!commitMessage || !commitMessage.trim()) {
            commitMessage = `Manual commit: All changes at ${new Date().toLocaleString()}`;
        }

        // Commit the changes
        await git.commit(commitMessage);
        vscode.window.showInformationMessage(`Committed changes: ${commitMessage}`);

        // Check if remote exists
        const remotes = await git.getRemotes(true);
        if (remotes.length === 0) {
            vscode.window.showWarningMessage("No remote repository configured. Changes committed locally only.");
            setStatusBarWorking(false);
            return;
        }

        // Sync with remote
        await git.pull();
        await git.push();
        vscode.window.showInformationMessage("Successfully committed and synced changes with remote");
        
    } catch (err) {
        vscode.window.showErrorMessage(`Commit and sync failed: ${err}`);
    } finally {
        setStatusBarWorking(false);
    }
}

/**
 * Updates the status bar item to reflect the enabled/disabled state.
 * @param enabled Whether autoGit is enabled.
 * @param show Whether to show the status bar item.
 */
function updateStatusBar(enabled: boolean, show: boolean) {
    if (!show) {
        if (statusBarItem) {
            statusBarItem.hide();
        }
        return;
    }
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        statusBarItem.command = "extension.autoGit.toggleEnabled";
    }
    statusBarItem.text = enabled
        ? "$(git-commit) autoGit: On"
        : "$(git-commit) autoGit: Off";
    statusBarItem.tooltip = enabled
        ? "autoGit is enabled"
        : "autoGit is disabled";
    statusBarItem.show();
}

/**
 * Debounced auto-commit: schedules a commit after a period of inactivity following edits.
 * @param document The VS Code text document being edited.
 */
function scheduleAutoCommitOnEdit(document: vscode.TextDocument) {
    if (document.uri.scheme !== 'file') return;
    const config = vscode.workspace.getConfiguration("vscode-autoGit");
    const debounceSeconds = config.get<number>("debounceIntervalSeconds", 30);
    const debounceMs = Math.max(5000, debounceSeconds * 1000); // minimum 5 seconds
    const filePath = document.fileName;
    if (commitTimers.has(filePath)) {
        clearTimeout(commitTimers.get(filePath)!);
    }
    commitTimers.set(
        filePath,
        setTimeout(() => {
            autoCommit(document);
            commitTimers.delete(filePath);
        }, debounceMs)
    );
}

/**
 * Schedules a debounced auto-commit on file save (for backward compatibility).
 * @param document The VS Code text document being saved.
 */
function scheduleAutoCommit(document: vscode.TextDocument) {
    // For backward compatibility: still debounce on save, but use the same logic
    scheduleAutoCommitOnEdit(document);
}

/**
 * Activates the extension, registering all commands, listeners, and timers.
 * @param context The VS Code extension context.
 */
export function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration("vscode-autoGit");
    const interval = config.get<number>("syncInterval", 10);
    const syncOnStartup = config.get<boolean>("syncOnStartup", true);
    const enabled = config.get<boolean>("enabled", false);
    const showStatusBar = config.get<boolean>("statusBar", true);
    updateStatusBar(enabled, showStatusBar);
    startSyncTimer(interval);

    if (syncOnStartup && enabled) {
        autoSync();
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document) {
                scheduleAutoCommitOnEdit(event.document);
            }
        })
    );
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(scheduleAutoCommit)
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(
            (e: vscode.ConfigurationChangeEvent) => {
                const config =
                    vscode.workspace.getConfiguration("vscode-autoGit");
                const enabled = config.get<boolean>("enabled", false);
                const showStatusBar = config.get<boolean>("statusBar", true);
                updateStatusBar(enabled, showStatusBar);
                if (e.affectsConfiguration("vscode-autoGit.syncInterval")) {
                    const newInterval = config.get<number>("syncInterval", 10);
                    startSyncTimer(newInterval);
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "extension.autoGit.toggleEnabled",
            toggleautoGitEnabled
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "extension.autoGit.commitAndSync",
            manualCommitAndSync
        )
    );
}

/**
 * Deactivates the extension, cleaning up timers.
 */
export function deactivate() {
    if (syncInterval) clearInterval(syncInterval);
}

/**
 * Generates a commit message using AI (if available) or a fallback message.
 * @param statusOutput The output of `git status --porcelain`.
 * @returns The generated commit message.
 */
async function generateCommitMessage(statusOutput: string): Promise<string> {
    let changedFiles: { path: string; status: string }[] = [];
    let diffs: string[] = [];
    try {
        // Parse git status output
        const lines: string[] = statusOutput
            .trim()
            .split("\n")
            .filter((line: string) => line.trim());
        changedFiles = lines.map((line: string) => {
            const status = line.substring(0, 2);
            const filename = line.substring(3);
            return {
                path: filename,
                status: getFileStatusFromCode(status),
            };
        });

        // Collect diffs for each changed file
        const root = getWorkspaceRoot();
        if (root && changedFiles.length > 0) {
            const simpleGitInstance = simpleGit(root);
            diffs = await Promise.all(
                changedFiles.map(async (f) => {
                    try {
                        // Use HEAD as the base for diff
                        const fileDiff = await simpleGitInstance.diff(["HEAD", "--", f.path]);
                        return `## ${f.path}\n---\n${fileDiff}`;
                    } catch {
                        return `## ${f.path}\n---\n(diff unavailable)`;
                    }
                })
            );
        }

        if (changedFiles.length === 0) {
            return "Auto-commit: Update files";
        }

        // Compose a rich prompt for Copilot/AI
        const prompt = `# Instructions

        You are a developer working on a project that uses Git for version control. You have made some changes to the codebase and are preparing to commit them to the repository. Your task is to summarize the changes that you have made into a concise commit message that describes the essence of the changes that were made.

        * Always start the commit message with a present tense verb such as "Update", "Fix", "Modify", "Add", "Improve", "Organize", "Arrange", "Mark", etc.
        * Respond in plain text, with no markdown formatting, and without any extra content. Simply respond with the commit message, and without a trailing period.
        * Don't reference the file paths that were changed, but make sure summarize all significant changes (using your best judgement).
        * When multiple files have been changed, give priority to edited files, followed by added files, and then renamed/deleted files.
        * When a change includes adding an emoji to a list item in markdown, then interpret a runner emoji as marking it as in progress, a checkmark emoji as meaning its completed, and a muscle emoji as meaning its a stretch goal.
        # Code change diffs

        ${diffs.join("\n\n")}

        # Commit message

        `;

        console.log("vscode-autoGit: Attempting to generate AI commit message...");

        // Try to use Copilot Chat API
        try {
            // Use the user's selected model if available, otherwise fall back to Copilot/gpt-4
            let models;
            if ((vscode as any).lm && typeof (vscode as any).lm.selectChatModels === "function") {
                // Try to get all available models (user's selection is prioritized by VS Code UI)
                models = await (vscode as any).lm.selectChatModels();
            }
            if (models && models.length > 0) {
                console.log(
                    `vscode-autoGit: Using user-selected LLM model: ${models[0].id || models[0].family}`
                );
                const model = models[0];
                const messages = [
                    (vscode as any).LanguageModelChatMessage.User(prompt),
                ];

                const response = await model.sendRequest(
                    messages,
                    {},
                    new (vscode as any).CancellationTokenSource().token
                );
                let commitMessage = "";
                for await (const fragment of response.text) {
                    commitMessage += fragment;
                }

                commitMessage = commitMessage.trim();
                if (commitMessage && commitMessage.length > 0) {
                    console.log(
                        "vscode-autoGit: AI commit message generated successfully"
                    );
                    return commitMessage;
                }
            } else {
                console.log("vscode-autoGit: No LLM models available");
            }
        } catch (copilotError: unknown) {
            if (
                typeof copilotError === "object" &&
                copilotError &&
                "message" in copilotError
            ) {
                console.warn(
                    "vscode-autoGit: Copilot API error:",
                    (copilotError as any).message
                );
            } else {
                console.warn("vscode-autoGit: Copilot API error:", copilotError);
            }
        }
    } catch (error: unknown) {
        if (typeof error === "object" && error && "message" in error) {
            console.warn(
                "vscode-autoGit: Could not generate AI commit message:",
                (error as any).message
            );
        } else {
            console.warn(
                "vscode-autoGit: Could not generate AI commit message:",
                error
            );
        }
    }
    // Fallback to simple commit message
    let fileList = '';
    if (changedFiles.length > 0) {
        fileList = changedFiles.map((f) => f.path).join(', ');
    } else {
        fileList = 'Update files';
    }
    const now = new Date().toLocaleString();
    console.log("vscode-autoGit: Using fallback commit message");
    return `Auto-commit: ${fileList} at ${now}`;
}

/**
 * Maps git porcelain status codes to human-readable file status.
 * @param statusCode The two-character git status code.
 * @returns The file status as a string.
 */
function getFileStatusFromCode(statusCode: string): string {
    // Git porcelain status codes
    if (statusCode.includes("A")) return "Added";
    if (statusCode.includes("M")) return "Modified";
    if (statusCode.includes("D")) return "Deleted";
    if (statusCode.includes("R")) return "Renamed";
    if (statusCode.includes("C")) return "Copied";
    if (statusCode.includes("?")) return "Untracked";
    return "Changed";
}
