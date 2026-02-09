#!/usr/bin/env node
// ag_deep.js - Deep probe for Antigravity chat (including webviews)
const puppeteer = require('puppeteer-core');

async function probe() {
    const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
    const pages = await browser.pages();

    console.log("=== ALL CDP TARGETS ===\n");
    const targets = await browser.targets();
    for (const t of targets) {
        console.log(`Type: ${t.type()} | URL: ${t.url().substring(0, 100)}`);
    }

    console.log("\n=== LOOKING FOR WEBVIEWS ===\n");

    // Check for webview targets (iframes, webviews)
    const webviewTargets = targets.filter(t =>
        t.type() === 'page' ||
        t.type() === 'webview' ||
        t.url().includes('webview')
    );

    for (const t of webviewTargets) {
        console.log(`\n--- Target: ${await t.url().substring(0, 80)} ---`);
        try {
            const p = await t.page();
            if (p) {
                const content = await p.evaluate(() => {
                    return {
                        title: document.title,
                        textareas: document.querySelectorAll('textarea').length,
                        inputs: document.querySelectorAll('input').length,
                        bodyPreview: (document.body.innerText || '').substring(0, 500)
                    };
                });
                console.log(JSON.stringify(content, null, 2));
            }
        } catch (e) {
            console.log(`Could not access: ${e.message}`);
        }
    }

    await browser.disconnect();
}

probe().catch(console.error);
