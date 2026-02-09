#!/usr/bin/env node
// ag_chat.js - Direct chat control for Antigravity Agent
const puppeteer = require('puppeteer-core');

const command = process.argv[2];
const arg = process.argv.slice(3).join(' ');

async function getManagerPage() {
    const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
    const pages = await browser.pages();

    for (const page of pages) {
        const title = await page.title();
        if (title === 'Manager') {
            return { browser, page };
        }
    }
    throw new Error('Manager page not found');
}

async function main() {
    const { browser, page } = await getManagerPage();

    switch (command) {
        case 'find-input':
            const inputs = await page.evaluate(() => {
                const results = [];

                // Check all elements with contenteditable
                document.querySelectorAll('[contenteditable="true"]').forEach(el => {
                    results.push({
                        type: 'contenteditable',
                        tag: el.tagName,
                        className: el.className,
                        text: el.innerText.substring(0, 100)
                    });
                });

                // Check for elements with 'Ask' in placeholder or aria-label
                document.querySelectorAll('[placeholder*="Ask"], [aria-label*="Ask"], [data-placeholder*="Ask"]').forEach(el => {
                    results.push({
                        type: 'placeholder',
                        tag: el.tagName,
                        className: el.className,
                        placeholder: el.placeholder || el.getAttribute('aria-label') || el.getAttribute('data-placeholder')
                    });
                });

                // Check ProseMirror editors (common in modern apps)
                document.querySelectorAll('.ProseMirror, [class*="prosemirror"], [class*="editor"], [class*="input"]').forEach(el => {
                    results.push({
                        type: 'editor',
                        tag: el.tagName,
                        className: el.className,
                        text: el.innerText.substring(0, 100)
                    });
                });

                return results;
            });
            console.log(JSON.stringify(inputs, null, 2));
            break;

        case 'type':
            // Use keyboard to type directly
            // First click to focus on likely chat area
            await page.click('body');
            await page.waitForTimeout(100);

            // Type the message
            await page.keyboard.type(arg);
            console.log(JSON.stringify({ status: 'typed', text: arg }));
            break;

        case 'send':
            // Click to focus, type, and submit
            // Try to find and click the chat input area
            const clicked = await page.evaluate(() => {
                // Look for the chat input by its placeholder text
                const allElements = document.querySelectorAll('*');
                for (const el of allElements) {
                    const text = el.innerText || '';
                    if (text.includes('Ask anything') && el.offsetParent !== null) {
                        el.click();
                        return { clicked: true, tag: el.tagName, className: el.className };
                    }
                }
                return { clicked: false };
            });

            if (clicked.clicked) {
                await page.waitForTimeout(200);
                await page.keyboard.type(arg);
                await page.waitForTimeout(100);

                // Try to click Submit or press Enter
                const submitted = await page.evaluate(() => {
                    const submitBtn = document.querySelector('button[class*="Submit"], button:has-text("Submit")');
                    if (submitBtn) {
                        submitBtn.click();
                        return { method: 'button' };
                    }
                    return { method: 'none' };
                });

                if (submitted.method === 'none') {
                    await page.keyboard.press('Enter');
                }

                console.log(JSON.stringify({ status: 'sent', text: arg, ...clicked, ...submitted }));
            } else {
                console.log(JSON.stringify({ status: 'could not find input', ...clicked }));
            }
            break;

        case 'click-submit':
            await page.evaluate(() => {
                const btns = document.querySelectorAll('button');
                for (const btn of btns) {
                    if (btn.innerText.includes('Submit')) {
                        btn.click();
                        return true;
                    }
                }
                return false;
            });
            console.log(JSON.stringify({ status: 'clicked submit' }));
            break;

        case 'read':
            const content = await page.evaluate(() => {
                return document.body.innerText;
            });
            console.log(content);
            break;

        case 'screenshot':
            await page.screenshot({ path: '/tmp/ag_chat.png' });
            console.log(JSON.stringify({ status: 'screenshot at /tmp/ag_chat.png' }));
            break;

        default:
            console.log(JSON.stringify({
                commands: ['find-input', 'type "text"', 'send "message"', 'click-submit', 'read', 'screenshot']
            }));
    }

    await browser.disconnect();
}

main().catch(e => console.log(JSON.stringify({ error: e.message })));
