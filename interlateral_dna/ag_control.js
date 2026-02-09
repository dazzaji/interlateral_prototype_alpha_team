#!/usr/bin/env node
// ag_control.js - Control Antigravity from Claude Code
// Usage: node ag_control.js <command> [args]
//   node ag_control.js read          - Read recent chat messages
//   node ag_control.js send "text"   - Send a message to the chat
//   node ag_control.js status        - Check connection status

const puppeteer = require('puppeteer-core');

const CDP_URL = 'http://127.0.0.1:9222';

async function connect() {
    const browser = await puppeteer.connect({ browserURL: CDP_URL });
    const pages = await browser.pages();

    // Find the main workspace page (not Launchpad)
    const workspacePage = pages.find(p =>
        p.url().includes('workbench.html') && !p.url().includes('jetski')
    );

    if (!workspacePage) {
        throw new Error('Could not find Antigravity workspace page');
    }

    return { browser, page: workspacePage };
}

async function getStatus() {
    try {
        const { browser, page } = await connect();
        const title = await page.title();
        console.log(JSON.stringify({
            status: 'connected',
            title: title,
            url: page.url()
        }));
        await browser.disconnect();
    } catch (err) {
        console.log(JSON.stringify({ status: 'error', error: err.message }));
    }
}

async function readChat(limit = 20) {
    try {
        const { browser, page } = await connect();

        // Try to find chat messages in the DOM
        // Antigravity uses various selectors for chat - we'll try common ones
        const messages = await page.evaluate((lim) => {
            const results = [];

            // Try different selectors for chat messages
            const selectors = [
                '.chat-message',
                '.message-content',
                '[class*="chat"]',
                '[class*="message"]',
                '.monaco-list-row',
                '.chat-item',
                '[role="listitem"]'
            ];

            for (const sel of selectors) {
                const elements = document.querySelectorAll(sel);
                if (elements.length > 0) {
                    elements.forEach((el, i) => {
                        if (i < lim) {
                            const text = el.innerText || el.textContent;
                            if (text && text.trim().length > 0) {
                                results.push({
                                    selector: sel,
                                    text: text.trim().substring(0, 500)
                                });
                            }
                        }
                    });
                    if (results.length > 0) break;
                }
            }

            return results;
        }, limit);

        console.log(JSON.stringify({ status: 'ok', messages: messages }));
        await browser.disconnect();
    } catch (err) {
        console.log(JSON.stringify({ status: 'error', error: err.message }));
    }
}

async function sendMessage(text) {
    try {
        const { browser, page } = await connect();

        // Try to find and focus the chat input
        const inputSelectors = [
            'textarea[class*="chat"]',
            'textarea[class*="input"]',
            '.chat-input textarea',
            '[class*="chatInput"] textarea',
            'textarea',
            '[contenteditable="true"]'
        ];

        let found = false;
        for (const sel of inputSelectors) {
            const input = await page.$(sel);
            if (input) {
                await input.click();
                await input.type(text);
                await page.keyboard.press('Enter');
                found = true;
                console.log(JSON.stringify({ status: 'sent', selector: sel, text: text }));
                break;
            }
        }

        if (!found) {
            // Fallback: use keyboard shortcut to open chat and type
            await page.keyboard.down('Meta');
            await page.keyboard.press('l');
            await page.keyboard.up('Meta');
            await page.waitForTimeout(500);
            await page.keyboard.type(text);
            await page.keyboard.press('Enter');
            console.log(JSON.stringify({ status: 'sent_via_shortcut', text: text }));
        }

        await browser.disconnect();
    } catch (err) {
        console.log(JSON.stringify({ status: 'error', error: err.message }));
    }
}

// Main
const command = process.argv[2];
const arg = process.argv.slice(3).join(' ');

switch (command) {
    case 'status':
        getStatus();
        break;
    case 'read':
        readChat(parseInt(arg) || 20);
        break;
    case 'send':
        if (!arg) {
            console.log(JSON.stringify({ status: 'error', error: 'No message provided' }));
        } else {
            sendMessage(arg);
        }
        break;
    default:
        console.log(JSON.stringify({
            status: 'help',
            commands: ['status', 'read [limit]', 'send "message"']
        }));
}
