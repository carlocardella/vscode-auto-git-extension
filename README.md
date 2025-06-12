# VSCode Auto Git Extension

<p align="center">
  <img src="icon2.png" alt="VSCode Auto Git Extension Icon" width="96" height="96">
</p>

This extension automatically checks in changes to your local repository on file save and periodically pulls/pushes to your remote (GitHub, Azure Repos, Bitbucket, etc.).

## Features
- **Auto-commit on file save** (if enabled)
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

## Limitations
- AI commit message generation is removed. Auto Git now uses a static commit message for auto-commits.

## Commit Message Generation

Auto Git now always uses a static commit message for auto-commits. AI-powered commit message generation (Copilot or other AI) has been removed for reliability and simplicity. The commit message format is:

```
Auto-commit: <filename> saved at <timestamp>
```

No AI, Copilot, or context logic is used for commit messages.

## Release Notes

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
