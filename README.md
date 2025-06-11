# VSCode Auto Git Extension

This extension automatically checks in changes to your local repository on file save and periodically pulls/pushes to GitHub.

## Features
- Auto-commit on file save
- Periodic pull/push to remote (configurable interval)

## Requirements
- Git must be installed and available in your PATH
- A local git repository must already be initialized

## Extension Settings
- `autogit.syncInterval`: Interval in minutes for periodic pull/push (default: 10)

## Development
- Run `npm install` to install dependencies
- Run `npm run compile` or `npm run webpack` to build

## Release Notes

### 0.1.0
- Initial release
