
const fs = require('fs');
const path = require('path');

const commsPath = path.join(__dirname, '../interlateral_dna/comms.md');

function extractTimestamp(line) {
    // Regex from watcher.js / parsers/index.js
    const match = line.match(/\[(\d{4}-\d{2}-\d{2})\s*T?(\d{2}:\d{2}:\d{2})?\]/);
    if (match) {
        const date = match[1];
        const time = match[2] || '00:00:00';
        return `${date}T${time}Z`;
    }
    return null;
}

try {
    const content = fs.readFileSync(commsPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    console.log(`Analyzing ${lines.length} lines from comms.md...`);

    const lastLines = lines.slice(-20); // Check last 20 lines

    lastLines.forEach((line, index) => {
        const extracted = extractTimestamp(line);
        console.log(`\nLine: ${line.substring(0, 50)}...`);
        console.log(`Timestamp Extracted: ${extracted || 'FAIL'}`);

        // Check regex match details
        const match = line.match(/\[(\d{4}-\d{2}-\d{2})\s*T?(\d{2}:\d{2}:\d{2})?\]/);
        if (match) {
            console.log(`Regex Groups: 1="${match[1]}" 2="${match[2]}"`);
        } else {
            console.log(`Regex Match: NULL`);
        }
    });

} catch (err) {
    console.error('Error:', err.message);
}
