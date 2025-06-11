# Changelog

## [0.1.2] - 2025-06-11
- Add status bar toggle to enable/disable Auto Git with one click
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
