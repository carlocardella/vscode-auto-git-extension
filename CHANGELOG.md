# Changelog

## [0.2.1] - 2025-09-04
- Removed unused `extension.autoGit` command from package.json (cleanup of dead code)
- Added command categories for better organization in VS Code Command Palette
- Commands now appear as "VSCode autoGit Extension: [Command Name]" for improved discoverability

## [0.2.0] - 2025-09-04
- Added new command "Commit and Sync Changes" for manual on-demand commit and sync operations

## [0.1.6] - 2025-06-12
- AI commit message generation now uses the LLM model selected by the user in VS Code, falling back to Copilot/gpt-4 only if no user-selected model is available.
- Extension package is now minimal: only strictly needed files are included in the VSIX for smaller size and faster install.

## [0.1.5] - 2025-06-12
- Debounce interval for auto-commit after inactivity is now user-configurable via `vscode-autoGit.debounceIntervalSeconds` (default: 30 seconds, minimum: 5 seconds)
- Auto-commit now triggers only after a true pause in editing, not just on save

## [0.1.4] - 2025-06-12
- AI commit message prompt now uses file diffs and gitdoc-style instructions for more meaningful, semantic commit messages
- Improved commit message quality for all auto-commits
- **Credits:** AI commit message logic and auto-commit workflow inspired by [GitDoc](https://github.com/lostintangent/gitdoc) and [AutoGit](https://github.com/Sonica-B/AutoGit/tree/main)

## [0.1.2] - 2025-06-11
- Add status bar toggle to enable/disable autoGit with one click
- Cleaned up debug traces for AI commit message logic
- AI commit message generation is attempted if possible, but falls back to generic message if not available

## [0.1.1] - 2025-06-11
- Cleaned up all debug traces for AI commit message logic
- AI commit message generation is attempted if possible, but falls back to generic message if not available

## [0.1.0] - 2025-06-11
- Initial preview release
- Auto-commit on file save (if enabled)
- Periodic pull/push to remote (if enabled)
- Sync on startup (optional)
- Sync after each commit (optional)
- Status bar indicator for enabled/disabled and working state (configurable)
- No errors if no remote is defined (commits only, skips sync)
- All features are opt-in via settings
