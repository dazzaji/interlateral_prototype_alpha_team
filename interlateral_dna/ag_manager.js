#!/usr/bin/env node
// ag_manager.js - Control the Agent Manager panel specifically
const puppeteer = require('puppeteer-core');

const command = process.argv[2];
const arg = process.argv.slice(3).join(' ');

async function getManagerPage() {
    const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
    const pages = await browser.pages();

    // Find the Manager page (not Launchpad)
    const manager = pages.find(p => p.url().includes('jetski'));

    // We need to find the one that's the actual agent panel (has chat input)
    for (const page of pages) {
        const title = await page.title();
        if (title === 'Manager') {
            return { browser, page };
        }
    }

    // Fallback to any jetski page
    const jetski = pages.find(p => p.url().includes('jetski'));
    return { browser, page: jetski };
}

async function main() {
    const { browser, page } = await getManagerPage();

    if (!page) {
        console.log(JSON.stringify({ error: 'No Manager page found' }));
        return;
    }

    switch (command) {
        case 'probe':
            const info = await page.evaluate(() => {
                const results = {
                    title: document.title,
                    inputs: [],
                    textareas: [],
                    buttons: [],
                    bodyPreview: (document.body.innerText || '').substring(0, 2000)
                };

                document.querySelectorAll('input').forEach(el => {
                    results.inputs.push({
                        type: el.type,
                        placeholder: el.placeholder,
                        className: el.className,
                        value: el.value
                    });
                });

                document.querySelectorAll('textarea').forEach(el => {
                    results.textareas.push({
                        placeholder: el.placeholder,
                        className: el.className,
                        value: el.value
                    });
                });

                document.querySelectorAll('button').forEach(el => {
                    const text = (el.innerText || '').trim();
                    if (text) {
                        results.buttons.push({ text: text.substring(0, 50), className: el.className });
                    }
                });

                return results;
            });
            console.log(JSON.stringify(info, null, 2));
            break;

        case 'send':
            // Find the chat input and send a message
            const result = await page.evaluate((text) => {
                // Look for input with "Ask anything" placeholder
                const inputs = document.querySelectorAll('input, textarea');
                for (const input of inputs) {
                    if (input.placeholder && input.placeholder.includes('Ask')) {
                        input.focus();
                        input.value = text;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        return { found: true, placeholder: input.placeholder };
                    }
                }

                // Try any visible text input
                for (const input of inputs) {
                    if (input.offsetParent !== null && input.type !== 'hidden') {
                        input.focus();
                        input.value = text;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        return { found: true, type: 'fallback', className: input.className };
                    }
                }

                return { found: false, inputCount: inputs.length };
            }, arg);

            if (result.found) {
                // Press Enter to send
                await page.keyboard.press('Enter');
                console.log(JSON.stringify({ status: 'sent', ...result, text: arg }));
            } else {
                console.log(JSON.stringify({ status: 'input_not_found', ...result }));
            }
            break;

        case 'read':
            // Read visible text (chat messages)
            const content = await page.evaluate(() => {
                return {
                    text: document.body.innerText,
                    html: document.body.innerHTML.substring(0, 5000)
                };
            });
            console.log(JSON.stringify({ status: 'ok', content: content.text.substring(0, 3000) }));
            break;

        case 'screenshot':
            await page.screenshot({ path: '/tmp/ag_manager.png' });
            console.log(JSON.stringify({ status: 'screenshot saved to /tmp/ag_manager.png' }));
            break;

        default:
            console.log(JSON.stringify({
                commands: ['probe', 'send "message"', 'read', 'screenshot']
            }));
    }

    await browser.disconnect();
}

main().catch(e => console.log(JSON.stringify({ error: e.message })));
