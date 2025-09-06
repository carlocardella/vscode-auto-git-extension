// Test runner for VS Code extension tests
import * as path from 'path';
import * as fs from 'fs';

// Use require for Mocha to avoid import issues
const Mocha = require('mocha');

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        timeout: 20000
    });

    const testsRoot = path.resolve(__dirname);

    return new Promise((resolve, reject) => {
        try {
            // Find all test files
            const files = fs.readdirSync(testsRoot).filter(file => 
                file.endsWith('.test.js')
            );

            // Add files to the test suite
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

            // Run the mocha test
            mocha.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            console.error(err);
            reject(err);
        }
    });
}
