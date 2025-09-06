// Test runner script using @vscode/test-electron
const { runTests } = require('@vscode/test-electron');
const path = require('path');

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../');

        // The path to test runner
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, '../out/tests/index');

        // Download VS Code, unzip it and run the integration test
        await runTests({ 
            extensionDevelopmentPath, 
            extensionTestsPath,
            // Optional: specify a workspace to open
            launchArgs: [
                path.resolve(__dirname, '../test-fixture'),
                // Add other VS Code arguments here if needed
                '--disable-extensions' // This helps avoid conflicts with other extensions
            ]
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();
