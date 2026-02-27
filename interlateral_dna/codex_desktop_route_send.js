#!/usr/bin/env node
/**
 * codex_desktop_route_send.js
 *
 * Route message to a specific Codex Desktop sidebar thread by text, then send.
 *
 * Usage:
 *   node codex_desktop_route_send.js list-threads
 *   node codex_desktop_route_send.js list-threads --contains "DeskAgent_01"
 *   node codex_desktop_route_send.js send --thread "DeskAgent_01_Describe project roadmap status" --msg "wake check"
 *   node codex_desktop_route_send.js send-file --thread "DeskAgent_01" /abs/path/msg.txt
 *
 * Env:
 *   CODEX_CDP_URL
 *   CODEX_CDP_URLS
 *   CODEX_CDP_TARGET_TITLE
 *   CODEX_CDP_TARGET_URL
 *   CODEX_CDP_ALLOW_UNSAFE=1  (bypass target-page safety gate)
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

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseUrls() {
  if (process.env.CODEX_CDP_URL) return [process.env.CODEX_CDP_URL];
  if (process.env.CODEX_CDP_URLS) {
    return process.env.CODEX_CDP_URLS.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_URLS;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const match = pages.find((p) => (p.url() || '').toLowerCase().includes(urlNeedle));
    if (match) return match;
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

async function listThreads(page) {
  return page.evaluate(() => {
    function isVisible(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    const roots = Array.from(document.querySelectorAll('aside, nav, [role="navigation"], [data-testid*="sidebar"]'));
    const scope = roots.length ? roots : [document.body];
    const selector = 'a, button, [role="button"], [data-testid*="thread"], [aria-label]';
    const out = [];
    const seen = new Set();

    for (const root of scope) {
      const nodes = Array.from(root.querySelectorAll(selector));
      for (const n of nodes) {
        if (!isVisible(n)) continue;
        const text = (n.innerText || n.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
        if (!text) continue;
        if (text.length < 3) continue;
        if (text.length > 180) continue;
        if (seen.has(text)) continue;
        seen.add(text);
        out.push(text);
      }
    }

    return out.slice(0, 200);
  });
}

async function focusThreadByText(page, threadNeedle, options = {}) {
  const needle = (threadNeedle || '').trim().toLowerCase();
  if (!needle) return { ok: false, reason: 'empty_thread_needle' };
  const matchMode = options.matchMode === 'exact' ? 'exact' : 'contains';
  const allowAmbiguous = options.allowAmbiguous === true;

  return page.evaluate((n, mode, allowMulti) => {
    function isVisible(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    const roots = Array.from(document.querySelectorAll('aside, nav, [role="navigation"], [data-testid*="sidebar"]'));
    const scope = roots.length ? roots : [document.body];
    const selector = 'a, button, [role="button"], [data-testid*="thread"], [aria-label]';
    const candidates = [];

    for (const root of scope) {
      const nodes = Array.from(root.querySelectorAll(selector));
      for (const node of nodes) {
        if (!isVisible(node)) continue;
        const text = (node.innerText || node.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
        if (!text) continue;
        const hay = text.toLowerCase();
        const matched = mode === 'exact' ? hay === n : hay.includes(n);
        if (!matched) continue;
        const score = Math.abs(text.length - n.length);
        candidates.push({ node, text, score });
      }
    }

    if (!candidates.length) return { ok: false, reason: 'thread_not_found', needle: n };
    if (!allowMulti && candidates.length !== 1) {
      return {
        ok: false,
        reason: 'thread_match_not_unique',
        needle: n,
        match_mode: mode,
        match_count: candidates.length,
        matches: candidates.slice(0, 20).map((c) => c.text)
      };
    }

    candidates.sort((a, b) => a.score - b.score);
    const chosen = candidates[0];
    chosen.node.scrollIntoView({ block: 'center', inline: 'nearest' });
    chosen.node.click();
    return {
      ok: true,
      matched_text: chosen.text,
      match_mode: mode,
      match_count: candidates.length,
      matches: candidates.slice(0, 20).map((c) => c.text)
    };
  }, needle, matchMode, allowAmbiguous);
}

async function readThreadMessages(page, limit = 60) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 60;
  return page.evaluate((lim) => {
    const out = [];
    const seen = new Set();

    function pushText(value) {
      const text = (value || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      if (text.length < 6) return;
      if (text.length > 1000) return;
      if (seen.has(text)) return;
      seen.add(text);
      out.push(text);
    }

    const selectors = [
      'main article',
      'main [data-message-author-role]',
      'main [data-testid*="message"]',
      'main [class*="message"]',
      'main [class*="turn"]'
    ];

    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        if (!el || !el.innerText) return;
        pushText(el.innerText);
      });
    }

    if (!out.length) {
      const main = document.querySelector('main');
      if (main && main.innerText) {
        main.innerText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .forEach(pushText);
      }
    }

    // UI fallback: some Codex builds render chat content outside expected message
    // selectors; capture visible pane text before giving up.
    if (!out.length) {
      const paneSelectors = [
        '[data-testid*="conversation"]',
        '[data-testid*="chat"]',
        '[data-testid*="thread"]',
        '[role="main"]',
        'section'
      ];
      for (const sel of paneSelectors) {
        document.querySelectorAll(sel).forEach((el) => {
          if (!el || !el.innerText) return;
          el.innerText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .forEach(pushText);
        });
      }
    }

    if (!out.length && document.body && document.body.innerText) {
      document.body.innerText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach(pushText);
    }

    return out.slice(-lim);
  }, safeLimit);
}

async function injectInPage(page, message) {
  await page.bringToFront();
  await sleep(200);

  const found = await page.evaluate(() => {
    function isVisible(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function inSidebar(el) {
      return Boolean(el.closest('aside, nav, [role="navigation"], [data-testid*="sidebar"]'));
    }

    const selectors = [
      'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]',
      '[data-testid*="composer"] textarea',
      '[data-testid*="input"] textarea'
    ];
    const candidates = [];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (!isVisible(el)) return;
        if (inSidebar(el)) return;
        const rect = el.getBoundingClientRect();
        candidates.push({
          el,
          tag: el.tagName.toLowerCase(),
          rect,
          score: (rect.top + rect.height) + rect.width
        });
      });
    });

    if (!candidates.length) return { ok: false, reason: 'no_input_found' };

    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates[0];

    const prev = document.querySelector('[data-codex-route-target="1"]');
    if (prev) prev.removeAttribute('data-codex-route-target');
    chosen.el.setAttribute('data-codex-route-target', '1');

    return {
      ok: true,
      kind: chosen.tag === 'textarea' || chosen.tag === 'input' ? chosen.tag : 'contenteditable',
      rect: {
        x: chosen.rect.x,
        y: chosen.rect.y,
        width: chosen.rect.width,
        height: chosen.rect.height
      }
    };
  });

  if (!found.ok) return found;

  const handle = await page.$('[data-codex-route-target="1"]');
  if (!handle) return { ok: false, reason: 'target_handle_missing' };

  await handle.click({ clickCount: 1, delay: 30 });
  await sleep(120);

  const setResult = await handle.evaluate((el, msg) => {
    const tag = (el.tagName || '').toLowerCase();
    const isTextInput = tag === 'textarea' || tag === 'input';

    el.focus();

    if (isTextInput) {
      el.value = msg;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, mode: 'value' };
    }

    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox') {
      if (document.execCommand) {
        document.execCommand('selectAll', false, null);
        const inserted = document.execCommand('insertText', false, msg);
        if (!inserted) {
          el.textContent = msg;
        }
      } else {
        el.textContent = msg;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return { ok: true, mode: 'contenteditable' };
    }

    return { ok: false, reason: 'unsupported_target', tag };
  }, message);

  if (!setResult || !setResult.ok) {
    return { ok: false, reason: 'set_message_failed', detail: setResult || null };
  }

  await sleep(180);
  await page.keyboard.press('Enter');
  await sleep(350);
  return { ok: true, sent: true, kind: found.kind, rect: found.rect, mode: setResult.mode };
}

function logToComms(message) {
  try {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const actor = logActor('Relay');
    const entry = `\n[${actor}] @CodexDesktopRoute [${timestamp}]\n${message}\n\n---\n`;
    fs.appendFileSync(COMMS_PATH, entry);
  } catch (_) {}
}

function usage() {
  console.log(`
codex_desktop_route_send.js

USAGE:
  node codex_desktop_route_send.js list-threads [--contains "needle"]
  node codex_desktop_route_send.js list-threads --contains "needle" --require-unique
  node codex_desktop_route_send.js send --thread "thread text" --msg "message" [--match exact|contains] [--allow-ambiguous]
  node codex_desktop_route_send.js send-file --thread "thread text" /abs/path/message.txt
  node codex_desktop_route_send.js read-thread --thread "thread text" [--limit 60] [--match exact|contains] [--allow-ambiguous]

ENV:
  CODEX_CDP_URL
  CODEX_CDP_URLS
  CODEX_CDP_TARGET_TITLE
  CODEX_CDP_TARGET_URL
  CODEX_CDP_ALLOW_UNSAFE=1
`);
}

async function main() {
  const cmd = process.argv[2];
  const urls = parseUrls();
  const { browser, browserURL, errors } = await connectFirst(urls);
  if (!browser) {
    console.log(JSON.stringify({
      status: 'error',
      reason: 'cdp_unreachable',
      tried_urls: urls,
      errors,
      hint: 'Relaunch Codex with --remote-debugging-port and retry.'
    }, null, 2));
    process.exit(1);
  }

  try {
    const page = await selectTargetPage(browser);
    const title = await page.title();
    const url = page.url();

    if (cmd === 'list-threads') {
      const contains = (getArg('--contains') || '').toLowerCase();
      const requireUnique = hasFlag('--require-unique');
      const threads = await listThreads(page);
      const filtered = contains ? threads.filter((t) => t.toLowerCase().includes(contains)) : threads;
      if (requireUnique && filtered.length !== 1) {
        console.log(JSON.stringify({
          status: 'error',
          reason: 'thread_match_not_unique',
          browser_url: browserURL,
          target: { title, url },
          contains,
          match_count: filtered.length,
          threads: filtered
        }, null, 2));
        process.exit(1);
      } else {
        console.log(JSON.stringify({
          status: 'ok',
          browser_url: browserURL,
          target: { title, url },
          thread_count: filtered.length,
          threads: filtered
        }, null, 2));
      }
      return;
    }

    if (cmd === 'send' || cmd === 'send-file' || cmd === 'read-thread') {
      const threadText = getArg('--thread');
      if (!threadText) {
        console.error('Missing --thread');
        usage();
        process.exit(1);
      }
      const matchMode = (getArg('--match') || 'contains').toLowerCase() === 'exact' ? 'exact' : 'contains';
      const allowAmbiguous = hasFlag('--allow-ambiguous');

      const routed = await focusThreadByText(page, threadText, { matchMode, allowAmbiguous });
      if (!routed.ok) {
        console.log(JSON.stringify({
          status: 'error',
          browser_url: browserURL,
          target: { title, url },
          failure: routed
        }, null, 2));
        process.exit(1);
      }

      if (cmd === 'read-thread') {
        await sleep(300);
        const limitRaw = Number.parseInt(getArg('--limit') || '60', 10);
        const messages = await readThreadMessages(page, Number.isFinite(limitRaw) ? limitRaw : 60);
        console.log(JSON.stringify({
          status: 'ok',
          browser_url: browserURL,
          target: { title, url },
          routed,
          message_count: messages.length,
          messages
        }, null, 2));
        return;
      }

      let rawMessage = '';
      if (cmd === 'send') {
        const msg = getArg('--msg');
        if (!msg) {
          console.error('Missing --msg');
          usage();
          process.exit(1);
        }
        rawMessage = msg;
      } else {
        const file = process.argv[process.argv.length - 1];
        if (!file || !fs.existsSync(file)) {
          console.error('File missing or not found.');
          usage();
          process.exit(1);
        }
        rawMessage = fs.readFileSync(file, 'utf8');
      }

      await sleep(400);
      const stamped = stampMessage(rawMessage);
      const result = await injectInPage(page, stamped);
      if (!result.ok) {
        console.log(JSON.stringify({
          status: 'error',
          browser_url: browserURL,
          target: { title, url },
          routed,
          failure: result
        }, null, 2));
        process.exit(1);
      }

      logToComms(stamped);
      console.log(JSON.stringify({
        status: 'sent',
        browser_url: browserURL,
        target: { title, url },
        routed,
        delivery: result
      }, null, 2));
      return;
    }

    usage();
    process.exit(1);
  } finally {
    await browser.disconnect();
  }
}

main().catch((err) => {
  console.log(JSON.stringify({ status: 'error', error: err.message }, null, 2));
  process.exit(1);
});
