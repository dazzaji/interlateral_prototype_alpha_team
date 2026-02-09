#!/usr/bin/env node
// ag_probe.js - Probe Antigravity DOM to find chat elements
const puppeteer = require('puppeteer-core');

async function probe() {
    const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
    const pages = await browser.pages();

    // Find the main workspace page
    const page = pages.find(p =>
        p.url().includes('workbench.html') && !p.url().includes('jetski')
    );

    if (!page) {
        console.log('No workspace page found');
        return;
    }

    // Look for Antigravity-specific chat elements
    const info = await page.evaluate(() => {
        const results = {
            chatPanels: [],
            textareas: [],
            potentialChatAreas: []
        };

        // Find elements with "agent" or "chat" in class/id
        document.querySelectorAll('[class*="agent"], [class*="chat"], [class*="Agent"], [class*="Chat"], [class*="copilot"], [class*="Copilot"]').forEach(el => {
            results.chatPanels.push({
                tag: el.tagName,
                className: el.className,
                id: el.id,
                text: (el.innerText || '').substring(0, 200)
            });
        });

        // Find all textareas
        document.querySelectorAll('textarea').forEach(el => {
            results.textareas.push({
                className: el.className,
                placeholder: el.placeholder,
                id: el.id
            });
        });

        // Find contenteditable elements
        document.querySelectorAll('[contenteditable="true"]').forEach(el => {
            results.potentialChatAreas.push({
                tag: el.tagName,
                className: el.className,
                text: (el.innerText || '').substring(0, 100)
            });
        });

        return results;
    });

    console.log(JSON.stringify(info, null, 2));
    await browser.disconnect();
}

probe().catch(console.error);
