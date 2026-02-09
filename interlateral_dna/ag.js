#!/usr/bin/env node
// ag.js v1.4.0 - Unified Antigravity control with logging
// All communications are logged to ag_log.md for human visibility
// v1.4.0: Added persistent telemetry and watch mode

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'ag_log.md');
const REPO_ROOT = path.resolve(__dirname, '..');
const AG_TELEMETRY_LOG = path.join(REPO_ROOT, '.gemini', 'ag_telemetry.log');
const CDP_URL = 'http://127.0.0.1:9222';
const SESSION_ID = process.env.OTEL_SESSION_ID || `session_${Date.now()}`;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function persistTelemetry(type, content) {
    const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        sessionId: SESSION_ID,
        type: type,
        content: content
    }) + '\n';

    try {
        const dir = path.dirname(AG_TELEMETRY_LOG);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.appendFileSync(AG_TELEMETRY_LOG, entry);
    } catch (err) {
        console.error(`⚠️  TELEMETRY FAILED: ${err.message}`);
    }
}

function log(direction, message) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const entry = `\n[${timestamp}] **${direction}:** ${message}\n`;
    fs.appendFileSync(LOG_FILE, entry);
    // console.error(`[LOGGED] ${direction}: ${message.substring(0, 50)}...`);
}

async function getManagerPage() {
    const browser = await puppeteer.connect({ browserURL: CDP_URL });
    const pages = await browser.pages();

    // First, look for a page titled "Manager" (standalone Agent Manager)
    for (const page of pages) {
        const title = await page.title();
        if (title === 'Manager') {
            return { browser, page };
        }
    }

    // Second, look for a workspace page (workbench.html but NOT jetski/Launchpad)
    for (const page of pages) {
        const url = page.url();
        if (url.includes('workbench.html') && !url.includes('jetski')) {
            return { browser, page };
        }
    }

    // Fallback to Launchpad (jetski page)
    const jetski = pages.find(p => p.url().includes('jetski'));
    if (jetski) {
        console.error('⚠️  WARNING: AG is on Launchpad, not a workspace!');
        return { browser, page: jetski };
    }

    throw new Error('Manager page not found. Is Antigravity running with --remote-debugging-port=9222?');
}

async function getAgentFrame(page) {
    const frames = page.frames();
    for (const frame of frames) {
        if (frame.url().includes('cascade-panel')) {
            return frame;
        }
    }
    return null;
}

async function send(message) {
    const { browser, page } = await getManagerPage();
    const agentFrame = await getAgentFrame(page);
    const targetFrame = agentFrame || page;

    // 1. Find and Focus Input
    const inputFound = await targetFrame.evaluate(() => {
        let input = document.querySelector('[contenteditable="true"].max-h-\\[300px\\]');
        if (!input) input = document.querySelector('[contenteditable="true"]');

        if (input) {
            input.focus();
            return true;
        }
        return false;
    });

    if (!inputFound) {
        console.log(JSON.stringify({ error: 'Could not find chat input' }));
        await browser.disconnect();
        return;
    }

    await sleep(200);

    // 2. Insert Text using execCommand (Best for React Editors)
    await targetFrame.evaluate((msg) => {
        document.execCommand('insertText', false, msg);
        // Dispatch 'input' just in case
        document.activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    }, message);

    await sleep(500);

    // 3. Submit using Enter key (Primary Method)
    console.log('Dispatching Enter key...');
    await page.keyboard.press('Enter');
    await sleep(300);

    // 4. Verify Clearance
    let isStillFull = await targetFrame.evaluate(() => {
        const input = document.querySelector('[contenteditable="true"]');
        return input && input.innerText.trim().length > 0;
    });

    // 5. Fallback: Aggressive DOM Events if still full
    if (isStillFull) {
        console.log('⚠️ Standard Enter failed. Trying aggressive DOM events...');
        await targetFrame.evaluate(() => {
            const input = document.querySelector('[contenteditable="true"]');
            if (!input) return;

            const events = [
                new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter' }),
                new KeyboardEvent('keypress', { bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter' }),
                new KeyboardEvent('keyup', { bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter' })
            ];

            events.forEach(e => input.dispatchEvent(e));
        });
        await sleep(500);
    }

    // 6. Final Check
    isStillFull = await targetFrame.evaluate(() => {
        const input = document.querySelector('[contenteditable="true"]');
        return input && input.innerText.trim().length > 0;
    });

    if (isStillFull) {
        console.error('❌ FAILED TO SUBMIT. Message remains in input box.');
        log('CC → AG', `FAILED DELIVERY: ${message}`); // Log failure
    } else {
        console.log('✅ Submitted successfully.');
        log('CC → AG', message);
    }

    console.log(JSON.stringify({ status: isStillFull ? 'failed_stuck' : 'sent', message: message }));
    persistTelemetry('send', { message, status: isStillFull ? 'failed' : 'sent' });
    await browser.disconnect();
}

async function read() {
    const { browser, page } = await getManagerPage();
    const agentFrame = await getAgentFrame(page);
    const targetFrame = agentFrame || page;

    const content = await targetFrame.evaluate(() => document.body.innerText);
    persistTelemetry('read', content);
    console.log(content);
    await browser.disconnect();
}

async function screenshot(filename = '/tmp/ag_screenshot.png') {
    const { browser, page } = await getManagerPage();
    await page.screenshot({ path: filename });
    console.log(JSON.stringify({ status: 'screenshot saved', path: filename }));
    await browser.disconnect();
}

async function watch(intervalMs = 5000) {
    console.log(`👁️  AG WATCHER STARTED (polling every ${intervalMs}ms)`);
    console.log(`📂 Logging to: ${AG_TELEMETRY_LOG}`);

    let lastContent = '';

    while (true) {
        try {
            const { browser, page } = await getManagerPage();
            const agentFrame = await getAgentFrame(page);
            const targetFrame = agentFrame || page;

            const content = await targetFrame.evaluate(() => document.body.innerText);

            if (content !== lastContent) {
                persistTelemetry('watch_change', content);
                lastContent = content;
                process.stdout.write('📝'); // Activity indicator
            } else {
                process.stdout.write('.'); // Heartbeat
            }

            await browser.disconnect();
        } catch (err) {
            process.stdout.write('❌');
            // console.error(`Watch Error: ${err.message}`);
        }
        await sleep(intervalMs);
    }
}

async function status() {
    try {
        const { browser, page } = await getManagerPage();
        const title = await page.title();
        const info = await page.evaluate(() => {
            const text = document.body.innerText;
            const lines = text.split('\n').filter(l => l.trim());
            return {
                tasks: lines.filter(l => l.includes('ago')).slice(0, 5),
                preview: text.substring(0, 500)
            };
        });
        console.log(JSON.stringify({ status: 'connected', title, ...info }, null, 2));
        await browser.disconnect();
    } catch (err) {
        console.log(JSON.stringify({ status: 'error', error: err.message }));
    }
}

async function logResponse(response) {
    log('AG → CC', response);
    console.log(JSON.stringify({ status: 'logged', response }));
}

async function debugUI() {
    const { browser, page } = await getManagerPage();
    const agentFrame = await getAgentFrame(page);
    const targetFrame = agentFrame || page;

    const html = await targetFrame.evaluate(() => document.documentElement.outerHTML);
    fs.writeFileSync('/tmp/ag_ui.html', html);
    console.log('UI HTML saved to /tmp/ag_ui.html');
    await browser.disconnect();
}

// Main Command Router
const command = process.argv[2];
const arg = process.argv.slice(3).join(' ');

switch (command) {
    case 'send':
        if (!arg) console.log('Usage: node ag.js send "your message"');
        else send(arg);
        break;
    case 'read':
        read();
        break;
    case 'screenshot':
        screenshot(arg || '/tmp/ag_screenshot.png');
        break;
    case 'status':
        status();
        break;
    case 'log-response':
        if (!arg) console.log('Usage: node ag.js log-response "AG response text"');
        else logResponse(arg);
        break;
    case 'debug':
        debugUI();
        break;
    case 'watch':
        watch(parseInt(arg) || 5000);
        break;
    default:
        console.log(`
Antigravity Control (ag.js) v1.4.0
==================================
Commands:
  node ag.js send "message"      - Send message to AG
  node ag.js read                - Read current AG panel text
  node ag.js watch [ms]          - Continuous watch (default 5000ms)
  node ag.js screenshot [path]   - Take screenshot
  node ag.js status              - Check connection status
  node ag.js debug               - Dump UI HTML for debugging
        `);
}
