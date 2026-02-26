#!/usr/bin/env node
/**
 * codex_desktop_send.js
 *
 * Inject a message directly into Codex Desktop chat UI over CDP.
 *
 * Usage:
 *   node codex_desktop_send.js send "message"
 *   node codex_desktop_send.js send-file path/to/file.txt
 *
 * Env:
 *   CODEX_CDP_URL          Optional explicit browserURL (ex: http://127.0.0.1:9223)
 *   CODEX_CDP_URLS         Optional comma-separated URLs to try
 *   CODEX_CDP_TARGET_TITLE Optional title substring to select target tab
 *   CODEX_CDP_TARGET_URL   Optional URL substring to select target tab
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { stampMessage, logActor } = require('./identity');

const COMMS_PATH = path.join(__dirname, 'comms.md');
const DEFAULT_URLS = [
  'http://127.0.0.1:9223',
  'http://127.0.0.1:9333',
  'http://127.0.0.1:9222'
];

function parseUrls() {
  if (process.env.CODEX_CDP_URL) return [process.env.CODEX_CDP_URL];
  if (process.env.CODEX_CDP_URLS) {
    return process.env.CODEX_CDP_URLS.split(',').map(s => s.trim()).filter(Boolean);
  }
  return DEFAULT_URLS;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function likelyCodexTarget(title, url) {
  const hay = `${title || ''} ${url || ''}`.toLowerCase();
  return hay.includes('codex') || hay.includes('chatgpt') || hay.includes('openai');
}

async function connectFirst(urls) {
  const errors = [];
  for (const browserURL of urls) {
    try {
      const browser = await puppeteer.connect({ browserURL, defaultViewport: null });
      return { browser, browserURL, errors };
    } catch (err) {
      errors.push({ browserURL, error: err.message });
    }
  }
  return { browser: null, browserURL: null, errors };
}

async function selectTargetPage(browser) {
  const pages = await browser.pages();
  const titleNeedle = (process.env.CODEX_CDP_TARGET_TITLE || '').toLowerCase();
  const urlNeedle = (process.env.CODEX_CDP_TARGET_URL || '').toLowerCase();
  const strictTargeting = process.env.CODEX_CDP_ALLOW_UNSAFE === '1' ? false : true;

  if (!pages.length) throw new Error('No CDP pages found.');
  if (strictTargeting && !titleNeedle && !urlNeedle) {
    throw new Error(
      'Safety gate: set CODEX_CDP_TARGET_TITLE or CODEX_CDP_TARGET_URL before sending (or set CODEX_CDP_ALLOW_UNSAFE=1 to bypass).'
    );
  }

  if (urlNeedle) {
    const m = pages.find(p => (p.url() || '').toLowerCase().includes(urlNeedle));
    if (m) return m;
    if (strictTargeting) {
      throw new Error(`Safety gate: no page URL matched CODEX_CDP_TARGET_URL='${process.env.CODEX_CDP_TARGET_URL}'.`);
    }
  }

  if (titleNeedle) {
    for (const p of pages) {
      const title = (await p.title()).toLowerCase();
      if (title.includes(titleNeedle)) return p;
    }
    if (strictTargeting) {
      throw new Error(`Safety gate: no page title matched CODEX_CDP_TARGET_TITLE='${process.env.CODEX_CDP_TARGET_TITLE}'.`);
    }
  }

  for (const p of pages) {
    const title = await p.title();
    const url = p.url();
    if (likelyCodexTarget(title, url)) return p;
  }

  return pages[0];
}

async function injectInPage(page, message) {
  await page.bringToFront();
  await sleep(150);

  const found = await page.evaluate((msg) => {
    function isVisible(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    const candidates = [];
    const selectors = [
      'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]',
      '[data-testid*="composer"] textarea',
      '[data-testid*="input"] textarea'
    ];

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (isVisible(el)) candidates.push(el);
      });
    });

    const input = candidates[0];
    if (!input) return { ok: false, reason: 'no_input_found' };

    input.focus();

    if (input.tagName.toLowerCase() === 'textarea' || input.tagName.toLowerCase() === 'input') {
      input.value = msg;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, kind: input.tagName.toLowerCase() };
    }

    // contenteditable path
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, msg);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true, kind: 'contenteditable' };
  }, message);

  if (!found.ok) return found;

  await sleep(250);
  await page.keyboard.press('Enter');
  await sleep(350);

  return { ok: true, sent: true, kind: found.kind };
}

function logToComms(message) {
  try {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const actor = logActor('Relay');
    const entry = `\n[${actor}] @CodexDesktop [${timestamp}]\n${message}\n\n---\n`;
    fs.appendFileSync(COMMS_PATH, entry);
  } catch (_) {}
}

async function sendMessage(raw) {
  const message = stampMessage(raw);
  const urls = parseUrls();
  const { browser, browserURL, errors } = await connectFirst(urls);

  if (!browser) {
    const out = {
      status: 'error',
      reason: 'cdp_unreachable',
      tried_urls: urls,
      errors,
      hint: 'Relaunch Codex app with --remote-debugging-port.'
    };
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  try {
    const page = await selectTargetPage(browser);
    const title = await page.title();
    const url = page.url();

    const result = await injectInPage(page, message);
    if (!result.ok) {
      console.log(JSON.stringify({
        status: 'error',
        browser_url: browserURL,
        target: { title, url },
        failure: result
      }, null, 2));
      process.exit(1);
    }

    logToComms(message);
    console.log(JSON.stringify({
      status: 'sent',
      browser_url: browserURL,
      target: { title, url },
      delivery: result
    }, null, 2));
  } finally {
    await browser.disconnect();
  }
}

function usage() {
  console.log(`
codex_desktop_send.js

USAGE:
  node codex_desktop_send.js send "message"
  node codex_desktop_send.js send-file path/to/file.txt

ENV:
  CODEX_CDP_URL          Explicit CDP URL (example: http://127.0.0.1:9223)
  CODEX_CDP_URLS         Comma list of CDP URLs to try
  CODEX_CDP_TARGET_TITLE Required target title substring (unless CODEX_CDP_ALLOW_UNSAFE=1)
  CODEX_CDP_TARGET_URL   Required target URL substring (unless CODEX_CDP_ALLOW_UNSAFE=1)
  CODEX_CDP_ALLOW_UNSAFE Set to 1 to bypass target safety gate
`);
}

(async () => {
  const [, , cmd, ...args] = process.argv;

  if (cmd === 'send') {
    if (!args.length) {
      console.error('No message provided.');
      usage();
      process.exit(1);
    }
    await sendMessage(args.join(' '));
    return;
  }

  if (cmd === 'send-file') {
    const file = args[0];
    if (!file || !fs.existsSync(file)) {
      console.error('File missing or not found.');
      usage();
      process.exit(1);
    }
    const content = fs.readFileSync(file, 'utf-8');
    await sendMessage(content);
    return;
  }

  usage();
  process.exit(1);
})();
