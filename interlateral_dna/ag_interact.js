#!/usr/bin/env node
// ag_interact.js - Interact with Antigravity Agent Chat
const puppeteer = require('puppeteer-core');

const command = process.argv[2];
const arg = process.argv.slice(3).join(' ');

async function main() {
    const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
    const pages = await browser.pages();

    // Find the main workspace page
    const page = pages.find(p =>
        p.url().includes('workbench.html') && !p.url().includes('jetski')
    );

    if (!page) {
        console.log(JSON.stringify({ error: 'No workspace page found' }));
        return;
    }

    switch (command) {
        case 'open-chat':
            // Try various methods to open the chat
            // Method 1: Click "Open Agent Manager" link
            await page.evaluate(() => {
                const link = document.querySelector('.open-agent-manager-button, [class*="open-agent"]');
                if (link) link.click();
            });
            await sleep(1000);
            console.log(JSON.stringify({ status: 'attempted to open agent manager' }));
            break;

        case 'screenshot':
            // Take a screenshot for debugging
            await page.screenshot({ path: '/tmp/antigravity.png', fullPage: false });
            console.log(JSON.stringify({ status: 'screenshot saved to /tmp/antigravity.png' }));
            break;

        case 'type':
            // Focus any textarea and type
            const typed = await page.evaluate((text) => {
                const textareas = document.querySelectorAll('textarea');
                for (const ta of textareas) {
                    if (ta.className.includes('input') || !ta.className.includes('xterm')) {
                        ta.focus();
                        ta.value = text;
                        ta.dispatchEvent(new Event('input', { bubbles: true }));
                        return { success: true, className: ta.className };
                    }
                }
                return { success: false, textareaCount: textareas.length };
            }, arg);
            console.log(JSON.stringify(typed));
            break;

        case 'key':
            // Send keyboard shortcut
            // Usage: node ag_interact.js key "Meta+Shift+i"
            const keys = arg.split('+');
            for (const k of keys) {
                if (k.toLowerCase() === 'meta') await page.keyboard.down('Meta');
                else if (k.toLowerCase() === 'shift') await page.keyboard.down('Shift');
                else if (k.toLowerCase() === 'ctrl') await page.keyboard.down('Control');
                else if (k.toLowerCase() === 'alt') await page.keyboard.down('Alt');
                else await page.keyboard.press(k);
            }
            for (const k of keys.reverse()) {
                if (['meta', 'shift', 'ctrl', 'alt'].includes(k.toLowerCase())) {
                    const keyMap = { meta: 'Meta', shift: 'Shift', ctrl: 'Control', alt: 'Alt' };
                    await page.keyboard.up(keyMap[k.toLowerCase()]);
                }
            }
            console.log(JSON.stringify({ status: 'key sent', keys: arg }));
            break;

        case 'click':
            // Click at coordinates or selector
            if (arg.includes(',')) {
                const [x, y] = arg.split(',').map(Number);
                await page.mouse.click(x, y);
                console.log(JSON.stringify({ status: 'clicked', x, y }));
            } else {
                await page.click(arg);
                console.log(JSON.stringify({ status: 'clicked selector', selector: arg }));
            }
            break;

        case 'dump':
            // Dump current page state
            const state = await page.evaluate(() => ({
                title: document.title,
                focusedElement: document.activeElement ? {
                    tag: document.activeElement.tagName,
                    className: document.activeElement.className,
                    id: document.activeElement.id
                } : null,
                visibleText: document.body.innerText.substring(0, 3000)
            }));
            console.log(JSON.stringify(state, null, 2));
            break;

        default:
            console.log(JSON.stringify({
                commands: [
                    'open-chat - Try to open agent chat panel',
                    'screenshot - Save screenshot to /tmp/antigravity.png',
                    'type "text" - Type text into focused textarea',
                    'key "Meta+Shift+i" - Send keyboard shortcut',
                    'click "selector" or "x,y" - Click element or coordinates',
                    'dump - Dump current page state'
                ]
            }));
    }

    await browser.disconnect();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(e => console.log(JSON.stringify({ error: e.message })));
