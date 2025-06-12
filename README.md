# VSCode Auto Git Extension

<p align="center">
  <img src="icon2.png" alt="VSCode Auto Git Extension Icon" width="96" height="96">
</p>

This extension automatically checks in changes to your local repository on file save and periodically pulls/pushes to your remote (GitHub, Azure Repos, Bitbucket, etc.).

## Features
- **Auto-commit on file save** (if enabled)
- **Auto-commit and sync of all pending changes on interval** (even if no file is saved; e.g. file deletions, renames, etc. are always committed)
- **Periodic pull/push to remote** (configurable interval, if enabled)
- **Sync on startup** (optional)
- **Sync after each commit** (optional)
- **Status bar indicator** shows if AutoGit is enabled and when it is working (configurable)
- **Works with any git remote**
- **All features are disabled by default**; you must enable them in the settings
- **No errors if no remote is defined** (commits only, skips sync)
- **Status bar toggle** - Click the status bar item to enable or disable Auto Git instantly.

## Extension Settings
- `vscode-autoGit.enabled` (boolean): If true, the extension will automatically commit and sync changes. If false, no git operations will be performed even if the extension is active.
- `vscode-autoGit.syncInterval` (number): Interval in minutes for periodic pull/push to the remote repository. Default: 10
- `vscode-autoGit.syncOnStartup` (boolean): If true, perform a git pull/push sync when the extension is activated, even if no file has been saved yet. Default: true
- `vscode-autoGit.syncAfterCommit` (boolean): If true, perform a git pull/push sync immediately after each auto-commit. Default: false
- `vscode-autoGit.statusBar` (boolean): Show a status bar indicator for Auto Git enabled/disabled state and working status. Default: true

## Requirements
- Git must be installed and available in your PATH
- A local git repository must already be initialized

## Usage
1. Install the extension (from VSIX or Marketplace).
2. Open your workspace/folder containing a git repository.
3. Go to Settings and search for "Auto Git" or "vscode-autoGit".
4. Enable `vscode-autoGit.enabled` and configure other options as desired.
5. Click the status bar item to quickly enable or disable Auto Git.

## How It Works
- On file save, all changes are staged and committed (if enabled).
- On the configured interval, **all pending changes** (including untracked, deleted, renamed, or updated files) are staged and committed, even if no file was saved. This ensures that actions like file deletions or renames are always committed and pushed.
- AI-powered commit message generation is attempted (using Copilot if available), otherwise a descriptive fallback message is used listing all changed files.

## Limitations
- Requires a local git repository.
- If no remote is defined, only local commits are made (no errors).

## Commit Message Generation

Auto Git attempts to use AI (Copilot) to generate a commit message for all staged changes. If unavailable, it falls back to a message like:

```
Auto-commit: <file1>, <file2>, ... at <timestamp>
```

## Release Notes

### 0.1.3 (Unreleased)
- Stage and commit all pending changes (including untracked, deleted, renamed, etc.) before every sync, even if no file is saved
- Improved fallback commit message to list all changed files
- AI commit message generation for all changes (if Copilot is available)

### 0.1.2
- Add status bar toggle to enable/disable Auto Git with one click
- Cleaned up debug traces for AI commit message logic
- AI commit message generation is attempted if possible, but falls back to generic message if not available

### 0.1.1
- Cleaned up debug traces for AI commit message logic
- AI commit message generation is attempted if possible, but falls back to generic message if not available

### 0.1.0
- Initial preview release
- All features are opt-in via settings
- Status bar indicator for enabled/disabled and working state
- No errors if no remote is defined (commits only, skips sync)
