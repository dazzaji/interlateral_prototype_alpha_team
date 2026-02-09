#!/usr/bin/env node
// ag_launchpad.js - Probe Antigravity Launchpad (Agent Manager)
const puppeteer = require('puppeteer-core');

async function probe() {
    const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
    const pages = await browser.pages();

    console.log("All pages:");
    for (const p of pages) {
        console.log("  - " + await p.title() + " | " + p.url());
    }

    // Find the Launchpad page
    const launchpad = pages.find(p => p.url().includes('jetski'));

    if (!launchpad) {
        console.log('\nNo Launchpad page found');
        await browser.disconnect();
        return;
    }

    console.log('\n--- Probing Launchpad ---');

    const info = await launchpad.evaluate(() => {
        const results = {
            chatInputs: [],
            messages: [],
            buttons: [],
            textContent: []
        };

        // Find textareas and inputs
        document.querySelectorAll('textarea, input[type="text"]').forEach(el => {
            results.chatInputs.push({
                tag: el.tagName,
                className: el.className,
                placeholder: el.placeholder || '',
                value: el.value || ''
            });
        });

        // Find anything that looks like messages
        document.querySelectorAll('[class*="message"], [class*="Message"], [class*="turn"], [class*="Turn"], [class*="response"], [class*="Response"]').forEach(el => {
            const text = (el.innerText || '').trim();
            if (text.length > 0 && text.length < 500) {
                results.messages.push({
                    className: el.className,
                    text: text.substring(0, 300)
                });
            }
        });

        // Find buttons
        document.querySelectorAll('button').forEach(el => {
            results.buttons.push({
                text: el.innerText || el.textContent,
                className: el.className
            });
        });

        // Get overall text content (trimmed)
        const bodyText = document.body.innerText || '';
        results.textContent = bodyText.substring(0, 2000);

        return results;
    });

    console.log(JSON.stringify(info, null, 2));
    await browser.disconnect();
}

probe().catch(console.error);
