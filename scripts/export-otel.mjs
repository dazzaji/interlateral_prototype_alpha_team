#!/usr/bin/env node
/**
 * export-otel.mjs - OTEL trace export from native telemetry bundles
 *
 * Extracted from export-skill-run.sh to avoid bash/Node.js template literal conflicts.
 *
 * Usage:
 *   node scripts/export-otel.mjs --session-id <id> --skill-name <name> --output <file> [options]
 *
 * Environment Variables (alternative to CLI args):
 *   SESSION_ID, SKILL_NAME, START_TIME, END_TIME, OUTPUT_FILE
 *   CC_OFFSET, CX_OFFSET, AG_OFFSET, EVENTS_LINES
 *   USE_NATIVE_BUNDLE, HARVEST_SESSION_ID
 *
 * @version 1.0
 * @date 2026-01-26
 * @reason Fix 12d - bash template literal substitution errors
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get script directory for relative imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Change to repo root for consistent paths
process.chdir(REPO_ROOT);

// Import OTEL exporter (path relative to repo root after chdir)
const otelExporterPath = path.join(REPO_ROOT, 'interlateral_comms_monitor/server/otel-exporter.js');
const { eventsToOtelTrace } = await import(`file://${otelExporterPath}`);

// Parse CLI arguments or use environment variables
function getConfig() {
  const args = process.argv.slice(2);
  const config = {
    sessionId: process.env.SESSION_ID || '',
    skillName: process.env.SKILL_NAME || 'dev-collaboration',
    startTime: process.env.START_TIME ? new Date(process.env.START_TIME).getTime() : Date.now() - 86400000,
    endTime: process.env.END_TIME ? new Date(process.env.END_TIME).getTime() : Date.now(),
    outputFile: process.env.OUTPUT_FILE || '',
    ccOffset: parseInt(process.env.CC_OFFSET) || 0,
    cxOffset: parseInt(process.env.CX_OFFSET) || 0,
    agOffset: parseInt(process.env.AG_OFFSET) || 0,
    eventsLines: parseInt(process.env.EVENTS_LINES) || 0,
    useNativeBundle: process.env.USE_NATIVE_BUNDLE === 'true',
    harvestSessionId: process.env.HARVEST_SESSION_ID || '',
  };

  // Parse CLI args (override env vars)
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--session-id':
        config.sessionId = args[++i];
        break;
      case '--skill-name':
        config.skillName = args[++i];
        break;
      case '--start-time':
        config.startTime = new Date(args[++i]).getTime();
        break;
      case '--end-time':
        config.endTime = new Date(args[++i]).getTime();
        break;
      case '--output':
        config.outputFile = args[++i];
        break;
      case '--cc-offset':
        config.ccOffset = parseInt(args[++i]);
        break;
      case '--cx-offset':
        config.cxOffset = parseInt(args[++i]);
        break;
      case '--ag-offset':
        config.agOffset = parseInt(args[++i]);
        break;
      case '--events-lines':
        config.eventsLines = parseInt(args[++i]);
        break;
      case '--native-bundle':
        config.useNativeBundle = true;
        config.harvestSessionId = args[++i];
        break;
    }
  }

  return config;
}

// ANSI stripping function
function stripAnsi(str) {
  if (!str) return '';
  return str
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

// Read file from byte offset
function readFromOffset(filePath, offset) {
  if (!fs.existsSync(filePath)) {
    return { status: 'NOT_FOUND', content: '' };
  }

  try {
    const stats = fs.statSync(filePath);
    const newBytes = stats.size - offset;

    if (newBytes <= 0) {
      return { status: 'EMPTY', content: '' };
    }

    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(newBytes);
    fs.readSync(fd, buffer, 0, newBytes, offset);
    fs.closeSync(fd);

    return { status: 'OK', content: stripAnsi(buffer.toString('utf8')) };
  } catch (e) {
    return { status: 'ERROR', content: '', error: e.message };
  }
}

// Helper to read log by LINE offset
function readFromLineOffset(filePath, lineOffset) {
  if (!fs.existsSync(filePath)) return { status: 'MISSING', content: '' };
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const slice = lines.slice(lineOffset).join('\n');
    return { status: 'OK', content: stripAnsi(slice) };
  } catch (e) {
    return { status: 'ERROR', content: '', error: e.message };
  }
}

// Native JSONL Parsers
function parseCcNative(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim());
  return lines.map(l => {
    try {
      const j = JSON.parse(l);
      if (j.type === 'user') {
        // Handle various content formats
        const content = j.message?.content;
        if (Array.isArray(content) && content[0]) {
          return `[USER] ${content[0].text || content[0].content || JSON.stringify(content[0])}`;
        }
        if (typeof content === 'string') {
          return `[USER] ${content}`;
        }
        return `[USER] ${JSON.stringify(j.message)}`;
      }
      if (j.type === 'assistant') {
        const content = j.message?.content;
        if (Array.isArray(content)) {
          return `[CC] ${content.map(c => c.text || c.thinking || '').join('\n')}`;
        }
        return '';
      }
      return '';
    } catch (e) { return ''; }
  }).filter(l => l).join('\n');
}

function parseCxNative(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim());
  return lines.map(l => {
    try {
      const j = JSON.parse(l);
      if (j.type === 'response_item' && j.payload) {
        const role = j.payload.role === 'user' ? 'USER' : 'CX';
        const content = j.payload.content;
        if (Array.isArray(content)) {
          return `[${role}] ${content.map(c => c.text || c.input_text || c.output_text || '').join('\n')}`;
        }
        return '';
      }
      return '';
    } catch (e) { return ''; }
  }).filter(l => l).join('\n');
}

// Pattern extraction functions
const BREAKER_PATTERNS = [
  /\[Codex\].*?(?:BREAKER|REQUEST.?CHANGES|FAILURE)/gi,
  /\[CX\].*?(?:BREAKER|REQUEST.?CHANGES|FAILURE)/gi,
  /FAILURE.?SCENARIO[:\s]*([^\n]+)/gi,
  /RED.?TEAM[:\s]*([^\n]+)/gi,
];

const REVIEWER_PATTERNS = [
  /\[AG\].*?(?:REVIEWER|APPROVE|SUGGESTION)/gi,
  /\[Antigravity\].*?(?:REVIEW|APPROVE|SUGGEST)/gi,
  /SUGGESTION[:\s]*([^\n]+)/gi,
  /RECOMMEND[:\s]*([^\n]+)/gi,
];

const DECLINE_PATTERNS = [
  /DECLINED?[:\s]*([^\n]+)/gi,
  /REJECTED?[:\s]*([^\n]+)/gi,
  /WILL.?NOT.?IMPLEMENT/gi,
  /OUT.?OF.?SCOPE/gi,
];

const CHANGELOG_PATTERNS = [
  /CHANGE.?LOG[:\s\n]*([^\n]+(?:\n[^\n]+)*)/gi,
  /REVISION[:\s\n]*([^\n]+)/gi,
  /ADDRESSED[:\s]*([^\n]+)/gi,
];

const APPROVAL_PATTERNS = [
  /(?:Verdict|Final Verdict|Sign-off)?[:\s]*\[(AG|Antigravity)\].*?(APPROVE|REQUEST.?CHANGES)/gi,
  /(?:Verdict|Final Verdict|Sign-off)?[:\s]*\[(Codex|CX)\].*?(APPROVE|REQUEST.?CHANGES)/gi,
];

// CX standalone approval pattern (matches "• APPROVE." without agent prefix)
const CX_STANDALONE_APPROVE = /[•\-\*]?\s*(APPROVE)\.?/gim;

// FIX 3C: Phrases that indicate template/instructional text (not actual content)
// AG SUGGESTION 3: Added more exclusion phrases
const TEMPLATE_EXCLUSION_PHRASES = [
  'End with verdict',
  'using this schema',
  'If You Are REVIEWER',
  'If You Are BREAKER',
  'Completion Criteria',
  'Example Prompt',
  'in this format:',
  '[What was fixed]',
  '[Title]',
  '[Specific change]',
  '3-5 failure scenarios',
  '3-5 actionable suggestions',
  '[YOUR_AGENT]',
  'Wait for Drafter',
  'Pattern is COMPLETE when'
];

// FIX 3C: Read structured review file directly
// AG SUGGESTION 1: Use flexible header matching ((?=## |$) instead of specific headers)
// AG SUGGESTION 2: Check for non-empty content
function readStructuredReviewFile(reviewFilePath) {
  if (!fs.existsSync(reviewFilePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(reviewFilePath, 'utf8');
    const result = {
      breaker_review: '',
      reviewer_suggestions: '',
      final_ag_verdict: null,
      final_cx_verdict: null
    };

    // Extract Codex Workspace section for breaker review
    // AG SUGGESTION 1: Use (?=\n## |$) for flexible header matching (anchored to line start)
    // FIX: Original (?=## |$) matched inside ### subheaders, returning empty sections
    const codexMatch = content.match(/## Codex Workspace\s*([\s\S]*?)(?=\n## |$)/i);
    if (codexMatch) {
      const sectionContent = codexMatch[1].trim();
      // AG SUGGESTION 2: Only use if non-empty (>50 chars to avoid just "---")
      if (sectionContent.length > 50) {
        result.breaker_review = sectionContent;
        // Find final Codex verdict - look for verdicts that are NOT inside backticks or prose
        // Valid patterns: "[Codex] APPROVE" at line start, or standalone "[Codex] APPROVE"
        const cxVerdicts = [...sectionContent.matchAll(/(?:^|\n)\s*(?:Verdict:?\s*)?\[Codex\]\s*(APPROVE|REQUEST[_\s]?CHANGES)/gim)];
        if (cxVerdicts.length > 0) {
          const lastVerdict = cxVerdicts[cxVerdicts.length - 1][1];
          result.final_cx_verdict = lastVerdict.toUpperCase().includes('REQUEST') ? 'REQUEST_CHANGES' : 'APPROVE';
        }
      }
    }

    // Extract Antigravity Workspace section for reviewer suggestions
    // FIX: Anchor to line start to avoid matching inside ### subheaders
    const agMatch = content.match(/## Antigravity Workspace\s*([\s\S]*?)(?=\n## |$)/i);
    if (agMatch) {
      const sectionContent = agMatch[1].trim();
      // AG SUGGESTION 2: Only use if non-empty
      if (sectionContent.length > 50) {
        result.reviewer_suggestions = sectionContent;
        // Find final AG verdict - look for verdicts that are NOT inside backticks or prose
        // Valid patterns: "[AG] APPROVE" at line start, or "Verdict: [AG] APPROVE", or standalone "[AG] APPROVE"
        const agVerdicts = [...sectionContent.matchAll(/(?:^|\n)\s*(?:Verdict:?\s*)?\[AG\]\s*(APPROVE|REQUEST[_\s]?CHANGES)/gim)];
        if (agVerdicts.length > 0) {
          const lastVerdict = agVerdicts[agVerdicts.length - 1][1];
          result.final_ag_verdict = lastVerdict.toUpperCase().includes('REQUEST') ? 'REQUEST_CHANGES' : 'APPROVE';
        }
      }
    }

    return result;
  } catch (e) {
    console.error(`  Warning: Could not read structured review file: ${e.message}`);
    return null;
  }
}

// FIX 3C: Extract Change Log from artifact file directly
function extractChangeLogFromArtifact(artifactPath) {
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(artifactPath, 'utf8');
    // Look for Change Log in comments (bash/shell scripts use #)
    const bashMatch = content.match(/# ## Change Log.*?\n((?:# - \*\*.*?\n)+)/i);
    if (bashMatch) {
      return '## Change Log (v1.1)\n' + bashMatch[1].replace(/^# /gm, '');
    }

    // Look for Change Log in markdown format
    // Hardened: Handle optional empty lines and capture until next header or EOF
    const mdMatch = content.match(/## Change Log.*?\n\s*([\s\S]*?)(?=\n## |$)/i);
    if (mdMatch) {
      const logBody = mdMatch[1].trim();
      if (logBody.length > 0) {
        return '## Change Log (v1.1)\n' + logBody;
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

// FIX 3C: Filter out template/instructional matches
function isTemplateText(text) {
  return TEMPLATE_EXCLUSION_PHRASES.some(phrase => text.includes(phrase));
}

function extractMatches(content, patterns) {
  const matches = [];
  for (const pattern of patterns) {
    const found = [...content.matchAll(pattern)];
    matches.push(...found.map(m => m[0]));
  }
  return matches.join('\n').trim() || null;
}

function extractApprovals(content) {
  const latestVerdicts = {};
  for (const pattern of APPROVAL_PATTERNS) {
    const found = [...content.matchAll(pattern)];
    for (const match of found) {
      const agent = match[1].toUpperCase().startsWith('A') ? 'AG' : 'CX';
      const verdict = match[2].toUpperCase().includes('REQUEST') ? 'REQUEST_CHANGES' : 'APPROVE';
      latestVerdicts[agent] = verdict;
    }
  }
  return Object.keys(latestVerdicts).map(agent => ({
    agent,
    verdict: latestVerdicts[agent],
    found: true
  }));
}

function extractCxApprovals(cxContent) {
  const found = [...cxContent.matchAll(CX_STANDALONE_APPROVE)];
  for (const match of found) {
    if (match[1] && match[1].toUpperCase().includes('APPROVE')) {
      return [{ agent: 'CX', verdict: 'APPROVE', found: true }];
    }
  }
  return [];
}

function extractDeclines(content) {
  if (!content || content === 'INVALID_DATA') return [];
  const declines = [];
  for (const pattern of DECLINE_PATTERNS) {
    const found = [...content.matchAll(pattern)];
    declines.push(...found.map(m => m[1] || m[0]).filter(d => {
      // Ignore common "none" or placeholder phrases
      return d && !/none|n\/a|no entries|no cases/i.test(d.trim());
    }));
  }
  return [...new Set(declines)];
}

// Main export function
async function exportTrace() {
  const config = getConfig();

  console.log('=== OTEL Export (export-otel.mjs) ===');
  console.log(`Session ID: ${config.sessionId}`);
  console.log(`Skill: ${config.skillName}`);
  console.log(`Output: ${config.outputFile}`);

  // Read telemetry logs
  let ccData, cxData, agData;

  if (config.useNativeBundle) {
    const bundleDir = `.observability/runs/${config.harvestSessionId}`;
    console.log(`\nReading native bundle: ${bundleDir}`);
    ccData = { status: 'OK', content: parseCcNative(`${bundleDir}/cc_native.jsonl`) };
    cxData = { status: 'OK', content: parseCxNative(`${bundleDir}/codex_native.jsonl`) };
    const agPath = `${bundleDir}/ag_native.log`;
    agData = {
      status: fs.existsSync(agPath) ? 'OK' : 'MISSING',
      content: fs.existsSync(agPath) ? stripAnsi(fs.readFileSync(agPath, 'utf8')) : ''
    };
  } else {
    console.log('\nReading telemetry logs...');
    ccData = readFromLineOffset('interlateral_dna/cc_telemetry.log', config.ccOffset);
    cxData = readFromLineOffset('interlateral_dna/codex_telemetry.log', config.cxOffset);
    agData = readFromLineOffset('.gemini/ag_telemetry.log', config.agOffset);
  }

  console.log(`  CC telemetry: ${ccData.status} (${ccData.content.length} chars)`);
  console.log(`  CX telemetry: ${cxData.status} (${cxData.content.length} chars)`);
  console.log(`  AG telemetry: ${agData.status} (${agData.content.length} chars)`);

  // Combine all content for extraction
  const allContent = [ccData.content, cxData.content, agData.content].join('\n');

  // Read events.jsonl
  const eventsFile = '.observability/events.jsonl';
  let events = [];
  if (fs.existsSync(eventsFile)) {
    const allLines = fs.readFileSync(eventsFile, 'utf8').split('\n');
    const relevantLines = allLines.slice(config.eventsLines);

    events = relevantLines
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line); }
        catch (e) { return null; }
      })
      .filter(e => e !== null)
      .filter(e => {
        if (!e.timestamp) return true;
        const eventTime = new Date(e.timestamp).getTime();
        return !isNaN(eventTime) && eventTime >= config.startTime && eventTime <= config.endTime;
      });
  }
  console.log(`  Events: ${events.length} in time range`);

  // FIX 3C: Try structured sources FIRST, then fall back to regex
  console.log('');
  console.log('FIX 3C: Checking structured data sources...');

  // CODEX FAILURE 1 FIX: Support explicit REVIEW_FILE env var to avoid mtime-based selection
  let reviewFilePath = process.env.REVIEW_FILE || null;
  let structuredData = null;

  if (reviewFilePath) {
    console.log(`  Using explicit REVIEW_FILE: ${reviewFilePath}`);
    structuredData = readStructuredReviewFile(reviewFilePath);
  } else if (fs.existsSync('projects/eval_data')) {
    // Fallback: auto-detect review file (newest by mtime)
    const reviewFiles = fs.readdirSync('projects/eval_data').filter(f => f.endsWith('_reviews.md'));
    if (reviewFiles.length > 0) {
      reviewFilePath = `projects/eval_data/${reviewFiles.sort((a, b) => {
        return fs.statSync(`projects/eval_data/${b}`).mtime - fs.statSync(`projects/eval_data/${a}`).mtime;
      })[0]}`;
      console.log(`  Auto-detected review file: ${reviewFilePath} (set REVIEW_FILE to override)`);
      structuredData = readStructuredReviewFile(reviewFilePath);
    }
  }

  // CODEX FAILURE 3 FIX: Support explicit CHANGE_LOG_FILE env var
  const changeLogFile = process.env.CHANGE_LOG_FILE || null;
  let artifactPath = process.env.ARTIFACT_PATH || null;
  let artifactChangeLog = null;

  if (!artifactPath && fs.existsSync('projects/eval_data/artifacts')) {
    const artifactFiles = fs.readdirSync('projects/eval_data/artifacts')
      .filter(f => /\.(md|txt)$/i.test(f));
    if (artifactFiles.length > 0) {
      artifactPath = `projects/eval_data/artifacts/${artifactFiles.sort((a, b) => {
        return fs.statSync(`projects/eval_data/artifacts/${b}`).mtime - fs.statSync(`projects/eval_data/artifacts/${a}`).mtime;
      })[0]}`;
      console.log(`  Auto-detected artifact file: ${artifactPath} (set ARTIFACT_PATH to override)`);
    }
  }

  if (changeLogFile && fs.existsSync(changeLogFile)) {
    // Read change log from explicit file
    console.log(`  Using explicit CHANGE_LOG_FILE: ${changeLogFile}`);
    artifactChangeLog = fs.readFileSync(changeLogFile, 'utf8').trim();
  } else if (artifactPath) {
    console.log(`  Checking artifact for Change Log: ${artifactPath}`);
    artifactChangeLog = extractChangeLogFromArtifact(artifactPath);
  }

  // Extract metadata: prefer structured sources, fall back to regex
  // CODEX FAILURE 2 FIX: Skip template filtering when using structured file (it's already clean)
  let breaker_review, reviewer_suggestions, change_log;
  let usedStructuredSource = false;

  if (structuredData && structuredData.breaker_review) {
    breaker_review = structuredData.breaker_review;
    usedStructuredSource = true;
    console.log(`  breaker_review: FROM STRUCTURED FILE (${breaker_review.length} chars)`);
  } else {
    breaker_review = extractMatches(allContent, BREAKER_PATTERNS) || 'INVALID_DATA';
    // CODEX FAILURE 2: Only filter template text for regex fallback, not structured
    if (breaker_review !== 'INVALID_DATA' && isTemplateText(breaker_review)) {
      console.log(`  breaker_review: FILTERED (was template text)`);
      breaker_review = 'INVALID_DATA';
    } else {
      console.log(`  breaker_review: FROM REGEX FALLBACK`);
    }
  }

  if (structuredData && structuredData.reviewer_suggestions) {
    reviewer_suggestions = structuredData.reviewer_suggestions;
    usedStructuredSource = true;
    console.log(`  reviewer_suggestions: FROM STRUCTURED FILE (${reviewer_suggestions.length} chars)`);
  } else {
    reviewer_suggestions = extractMatches(allContent, REVIEWER_PATTERNS) || 'INVALID_DATA';
    if (reviewer_suggestions !== 'INVALID_DATA' && isTemplateText(reviewer_suggestions)) {
      console.log(`  reviewer_suggestions: FILTERED (was template text)`);
      reviewer_suggestions = 'INVALID_DATA';
    } else {
      console.log(`  reviewer_suggestions: FROM REGEX FALLBACK`);
    }
  }

  if (artifactChangeLog) {
    change_log = artifactChangeLog;
    console.log(`  change_log: FROM ARTIFACT/EXPLICIT FILE`);
  } else {
    change_log = extractMatches(allContent, CHANGELOG_PATTERNS) || 'INVALID_DATA';
    if (change_log !== 'INVALID_DATA' && isTemplateText(change_log)) {
      console.log(`  change_log: FILTERED (was template text)`);
      change_log = 'INVALID_DATA';
    } else {
      console.log(`  change_log: FROM REGEX FALLBACK`);
    }
  }

  // Hardened: Restrict declines search to change_log if found, to avoid log-data pollution
  const declines = extractDeclines(change_log !== 'INVALID_DATA' ? change_log : allContent);

  // FIX 3C: Use structured verdicts if available, otherwise fall back to regex
  let approvals;
  if (structuredData && (structuredData.final_ag_verdict || structuredData.final_cx_verdict)) {
    approvals = [];
    if (structuredData.final_ag_verdict) {
      approvals.push({ agent: 'AG', verdict: structuredData.final_ag_verdict, found: true, source: 'structured' });
    }
    if (structuredData.final_cx_verdict) {
      approvals.push({ agent: 'CX', verdict: structuredData.final_cx_verdict, found: true, source: 'structured' });
    }
    console.log(`  approvals: FROM STRUCTURED FILE (AG=${structuredData.final_ag_verdict}, CX=${structuredData.final_cx_verdict})`);
  } else {
    approvals = extractApprovals(allContent);
    // Merge CX standalone approvals
    const cxStandaloneApprovals = extractCxApprovals(cxData.content);
    for (const cxApproval of cxStandaloneApprovals) {
      if (!approvals.find(a => a.agent === 'CX')) {
        approvals.push(cxApproval);
      }
    }
    console.log(`  approvals: FROM REGEX FALLBACK`);
  }

  const all_approved = approvals.length >= 2 && approvals.every(a => a.verdict === 'APPROVE');
  console.log(`  all_approved: ${all_approved}`);

  // Extract user_prompt
  const promptEvent = events.find(e =>
    e.type === 'user_prompt' ||
    e.type === 'assignment' ||
    (e.content && e.content.includes('Execute') && e.source === 'human')
  );

  let user_prompt = 'INVALID_DATA';
  if (promptEvent) {
    user_prompt = promptEvent.content;
  } else if (ccData.content.includes('[USER]')) {
    const userMatch = ccData.content.match(/\[USER\] (.*?)(?=\n\[CC\]|\n$|$)/s);
    if (userMatch) user_prompt = userMatch[1].trim();
  }

  // KILL SWITCH
  if (user_prompt === 'INVALID_DATA') {
    console.error('');
    console.error('🛑 KILL SWITCH: user_prompt is INVALID_DATA');
    console.error('   Cannot export trace without valid user prompt.');
    console.error('   Check: Was the session captured? Did CC log any user messages?');
    console.error('   Run verify-harvest.sh first to diagnose.');
    process.exit(1);
  }

  // Build structured metadata
  const structuredMetadata = {
    breaker_review: breaker_review.substring(0, 2000),
    reviewer_suggestions: reviewer_suggestions.substring(0, 2000),
    change_log: change_log.substring(0, 2000),
    declines,
    declined_items_count: declines.length,
    user_prompt: user_prompt.substring(0, 500),
    approvals,
    all_approved,
    data_quality: {
      cc_telemetry: ccData.status,
      codex_telemetry: cxData.status,
      ag_telemetry: agData.status,
      events_jsonl: events.length > 0 ? 'OK' : 'EMPTY'
    },
    session_boundaries: {
      start: new Date(config.startTime).toISOString(),
      end: new Date(config.endTime).toISOString(),
      source: config.useNativeBundle ? 'native_bundle' : 'line_offsets'
    }
  };

  console.log('');
  console.log('Structured Metadata:');
  console.log(`  breaker_review: ${breaker_review !== 'INVALID_DATA' ? 'Found' : 'INVALID_DATA'}`);
  console.log(`  reviewer_suggestions: ${reviewer_suggestions !== 'INVALID_DATA' ? 'Found' : 'INVALID_DATA'}`);
  console.log(`  change_log: ${change_log !== 'INVALID_DATA' ? 'Found' : 'INVALID_DATA'}`);
  console.log(`  declines: ${declines.length}`);
  console.log(`  approvals: ${JSON.stringify(approvals)}`);
  console.log(`  all_approved: ${all_approved}`);

  // Generate OTEL trace
  const trace = eventsToOtelTrace(events, {
    skillName: config.skillName,
    sessionId: config.sessionId,
    structuredMetadata
  });

  // Add structured metadata to resource attributes
  if (trace.resourceSpans && trace.resourceSpans[0]) {
    const attrs = trace.resourceSpans[0].resource.attributes;
    attrs.push({ key: 'metadata.breaker_review', value: { stringValue: structuredMetadata.breaker_review } });
    attrs.push({ key: 'metadata.reviewer_suggestions', value: { stringValue: structuredMetadata.reviewer_suggestions } });
    attrs.push({ key: 'metadata.change_log', value: { stringValue: structuredMetadata.change_log } });
    attrs.push({ key: 'metadata.user_prompt', value: { stringValue: structuredMetadata.user_prompt } });
    attrs.push({ key: 'metadata.declined_items_count', value: { intValue: structuredMetadata.declined_items_count } });
    attrs.push({ key: 'metadata.all_approved', value: { boolValue: structuredMetadata.all_approved } });
    attrs.push({ key: 'metadata.approvals', value: { stringValue: JSON.stringify(structuredMetadata.approvals) } });
    attrs.push({ key: 'metadata.data_quality', value: { stringValue: JSON.stringify(structuredMetadata.data_quality) } });
  }

  // Ensure output directory exists
  const outputDir = path.dirname(config.outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(config.outputFile, JSON.stringify(trace, null, 2));
  console.log('');
  console.log(`✅ Trace exported to: ${config.outputFile}`);
}

// Run
exportTrace().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
