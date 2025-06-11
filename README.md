# VSCode Auto Git Extension

This extension automatically checks in changes to your local repository on file save and periodically pulls/pushes to your remote (GitHub, Azure Repos, Bitbucket, etc.).

## Features
- **Auto-commit on file save** (if enabled)
- **Periodic pull/push to remote** (configurable interval, if enabled)
- **Sync on startup** (optional)
- **Sync after each commit** (optional)
- **Works with any git remote**
- **All features are disabled by default**; you must enable them in the settings

## Extension Settings
- `vscode-autoGit.enabled` (boolean): If true, the extension will automatically commit and sync changes. If false, no git operations will be performed even if the extension is active.
- `vscode-autoGit.syncInterval` (number): Interval in minutes for periodic pull/push to the remote repository. Default: 10
- `vscode-autoGit.syncOnStartup` (boolean): If true, perform a git pull/push sync when the extension is activated, even if no file has been saved yet. Default: true
- `vscode-autoGit.syncAfterCommit` (boolean): If true, perform a git pull/push sync immediately after each auto-commit. Default: false

## Requirements
- Git must be installed and available in your PATH
- A local git repository must already be initialized

## Usage
1. Install the extension (from VSIX or Marketplace).
2. Open your workspace/folder containing a git repository.
3. Go to Settings and search for "Auto Git" or "vscode-autoGit".
4. Enable `vscode-autoGit.enabled` and configure other options as desired.

## Development
- Run `npm install` to install dependencies
- Run `npm run compile` or `npm run webpack` to build

## Release Notes

### 0.1.0
- Initial preview release
- All features are opt-in via settings
