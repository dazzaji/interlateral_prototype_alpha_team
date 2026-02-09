#!/usr/bin/env node
// ag_send.js - Send message to Antigravity Agent chat
const puppeteer = require('puppeteer-core');

const message = process.argv.slice(2).join(' ');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    if (!message) {
        console.log(JSON.stringify({ error: 'No message provided. Usage: node ag_send.js "your message"' }));
        return;
    }

    const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
    const pages = await browser.pages();

    // Find Manager page
    let managerPage;
    for (const page of pages) {
        const title = await page.title();
        if (title === 'Manager') {
            managerPage = page;
            break;
        }
    }

    if (!managerPage) {
        console.log(JSON.stringify({ error: 'Manager page not found' }));
        await browser.disconnect();
        return;
    }

    // Find and click the contenteditable chat input
    const inputClicked = await managerPage.evaluate(() => {
        const input = document.querySelector('[contenteditable="true"].max-h-\\[300px\\]');
        if (input) {
            input.click();
            input.focus();
            return { found: true, className: input.className };
        }

        // Fallback: find any contenteditable
        const fallback = document.querySelector('[contenteditable="true"]');
        if (fallback) {
            fallback.click();
            fallback.focus();
            return { found: true, fallback: true, className: fallback.className };
        }

        return { found: false };
    });

    if (!inputClicked.found) {
        console.log(JSON.stringify({ error: 'Could not find chat input', ...inputClicked }));
        await browser.disconnect();
        return;
    }

    await sleep(200);

    // Type the message
    await managerPage.keyboard.type(message, { delay: 10 });

    await sleep(100);

    // Submit via Enter key or Submit button
    // Try clicking Submit button first
    const submitClicked = await managerPage.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
            if (btn.innerText.trim() === 'Submit' || btn.className.includes('Submit')) {
                btn.click();
                return { method: 'button', buttonText: btn.innerText.trim() };
            }
        }
        return { method: 'none' };
    });

    if (submitClicked.method === 'none') {
        // Fallback to Cmd+Enter or Enter
        await managerPage.keyboard.down('Meta');
        await managerPage.keyboard.press('Enter');
        await managerPage.keyboard.up('Meta');
        submitClicked.method = 'cmd+enter';
    }

    console.log(JSON.stringify({
        status: 'sent',
        message: message,
        inputClicked: inputClicked,
        submitMethod: submitClicked.method
    }));

    await browser.disconnect();
}

main().catch(e => console.log(JSON.stringify({ error: e.message })));
