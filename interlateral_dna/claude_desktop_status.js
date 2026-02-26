#!/usr/bin/env node
/**
 * claude_desktop_status.js
 *
 * Inspect Claude Desktop renderer targets over CDP.
 * Usage:
 *   node claude_desktop_status.js
 *
 * Env:
 *   CLAUDE_CDP_URL          Optional explicit browserURL (ex: http://127.0.0.1:9444)
 *   CLAUDE_CDP_URLS         Optional comma-separated URLs to try
 */

const puppeteer = require('puppeteer-core');

const DEFAULT_URLS = [
  'http://127.0.0.1:9444',
  'http://127.0.0.1:9334',
  'http://127.0.0.1:9224'
];

function parseUrls() {
  if (process.env.CLAUDE_CDP_URL) return [process.env.CLAUDE_CDP_URL];
  if (process.env.CLAUDE_CDP_URLS) {
    return process.env.CLAUDE_CDP_URLS.split(',').map(s => s.trim()).filter(Boolean);
  }
  return DEFAULT_URLS;
}

function likelyClaudeTarget(title, url) {
  const hay = `${title || ''} ${url || ''}`.toLowerCase();
  return hay.includes('claude') || hay.includes('anthropic');
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

async function run() {
  const urls = parseUrls();
  const { browser, browserURL, errors } = await connectFirst(urls);

  if (!browser) {
    console.log(JSON.stringify({
      status: 'error',
      reason: 'cdp_unreachable',
      tried_urls: urls,
      errors,
      hint: 'Relaunch Claude Desktop with --remote-debugging-port and retry.'
    }, null, 2));
    process.exit(1);
  }

  try {
    const pages = await browser.pages();
    const targets = [];

    for (let i = 0; i < pages.length; i += 1) {
      const p = pages[i];
      const title = await p.title();
      const url = p.url();
      let hasInput = false;
      try {
        hasInput = await p.evaluate(() => {
          const selectors = [
            'textarea',
            '[contenteditable="true"]',
            '[role="textbox"]'
          ];
          return selectors.some(sel => document.querySelector(sel));
        });
      } catch (_) {}

      targets.push({
        index: i,
        title,
        url,
        likely_claude: likelyClaudeTarget(title, url),
        has_input_candidate: hasInput
      });
    }

    console.log(JSON.stringify({
      status: 'ok',
      browser_url: browserURL,
      target_count: targets.length,
      targets
    }, null, 2));
  } finally {
    await browser.disconnect();
  }
}

run().catch(err => {
  console.log(JSON.stringify({ status: 'error', error: err.message }, null, 2));
  process.exit(1);
});
