import * as vscode from "vscode";
import simpleGit, { SimpleGit } from "simple-git";
import * as path from "path";

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

function startSyncTimer(intervalMinutes: number) {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(autoSync, intervalMinutes * 60 * 1000);
}

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
}

export function deactivate() {
    if (syncInterval) clearInterval(syncInterval);
}

async function generateCommitMessage(statusOutput: string): Promise<string> {
    let changedFiles: { path: string; status: string }[] = [];
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

        if (changedFiles.length === 0) {
            return "Auto-commit: Update files";
        }

        // Create context for Copilot
        const context = `Generate a concise commit message for the following changes:
${changedFiles
    .map((f) => `${f.status}: ${f.path}`)
    .join("\n")}

Guidelines:
- Be concise and descriptive
- Describe WHAT was changed, not HOW
- Use present tense ("add" not "added")

Generate only the commit message, no quotes or explanation.`;

        console.log("autoGit: Attempting to generate AI commit message...");

        // Try to use Copilot Chat API
        try {
            if (
                (vscode as any).lm &&
                typeof (vscode as any).lm.selectChatModels === "function"
            ) {
                const models = await (vscode as any).lm.selectChatModels({
                    vendor: "copilot",
                    family: "gpt-4",
                });

                if (models && models.length > 0) {
                    console.log(
                        "autoGit: Copilot model found, generating message..."
                    );
                    const model = models[0];
                    const messages = [
                        (vscode as any).LanguageModelChatMessage.User(context),
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
                            "autoGit: AI commit message generated successfully"
                        );
                        return commitMessage;
                    }
                } else {
                    console.log("vscode-autoGit: No Copilot models available");
                }
            } else {
                console.log(
                    "vscode-autoGit: Copilot Language Model API not available"
                );
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
