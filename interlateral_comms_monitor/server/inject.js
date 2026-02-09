import { appendFile } from 'fs/promises';
import { spawn, execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to project root and DNA directory
const PROJECT_ROOT = join(__dirname, '..', '..');
const DNA_PATH = join(PROJECT_ROOT, 'interlateral_dna');
const COMMS_PATH = join(DNA_PATH, 'comms.md');
const AG_JS_PATH = join(DNA_PATH, 'ag.js');

// Default tmux session names
const CC_TMUX_SESSION = process.env.CC_TMUX_SESSION || 'claude';
const CODEX_TMUX_SESSION = process.env.CODEX_TMUX_SESSION || 'codex';

// Path to codex.js for Codex injection
const CODEX_JS_PATH = join(DNA_PATH, 'codex.js');

/**
 * Check if a tmux session exists
 */
function checkTmuxSession(sessionName = CC_TMUX_SESSION) {
  try {
    execSync(`tmux has-session -t ${sessionName} 2>/dev/null`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Try to inject directly to Claude Code via tmux send-keys (PRIMARY method)
 * Requires CC to be running in a tmux session named 'claude' (or CC_TMUX_SESSION env var)
 */
function tryTmuxInjection(message, sessionName = CC_TMUX_SESSION) {
  if (!checkTmuxSession(sessionName)) {
    return { success: false, method: 'tmux', reason: `tmux session '${sessionName}' not found` };
  }

  try {
    // Escape special characters for tmux
    const escaped = message
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');

    // Send the message followed by Enter
    execSync(`tmux send-keys -t ${sessionName} "${escaped}" Enter`, { timeout: 5000 });
    console.log(`[Inject] Direct injection to CC via tmux session '${sessionName}' succeeded!`);
    return { success: true, method: 'tmux', session: sessionName };
  } catch (error) {
    return { success: false, method: 'tmux', reason: error.message };
  }
}

/**
 * Try to inject directly to VS Code via AppleScript (macOS only) - SECONDARY method
 */
function tryAppleScriptInjection(message) {
  if (process.platform !== 'darwin') {
    return { success: false, reason: 'not macOS' };
  }

  // Escape special characters for AppleScript
  const escaped = message
    .replace(/\\/g, '\\\\\\\\')
    .replace(/"/g, '\\\\"')
    .replace(/\n/g, '\\n');

  const script = `
tell application "Visual Studio Code"
  activate
  delay 0.3
end tell
tell application "System Events"
  tell process "Code"
    keystroke "${escaped}"
    keystroke return
  end tell
end tell
`;

  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, { timeout: 5000 });
    return { success: true, method: 'applescript' };
  } catch (error) {
    return { success: false, method: 'applescript', reason: error.message };
  }
}

/**
 * Get status of available CC injection methods
 */
export function getCCInjectionStatus() {
  return {
    tmux: {
      available: checkTmuxSession(),
      session: CC_TMUX_SESSION,
    },
    applescript: {
      available: process.platform === 'darwin',
    },
    comms: {
      available: true,
      path: COMMS_PATH,
    },
  };
}

/**
 * Inject a message to Claude Code
 * Priority: 1. tmux (PRIMARY) 2. AppleScript (if directMode) 3. comms.md (FALLBACK)
 */
export async function injectToCC(message, directMode = false) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const formatted = `\n[INJECTED] @CC [${timestamp}]\n${message}\n`;

  // Always log to comms.md for record
  try {
    await appendFile(COMMS_PATH, formatted, 'utf-8');
    console.log('[Inject] Message logged to comms.md');
  } catch (error) {
    console.error('[Inject] Failed to log to comms.md:', error.message);
  }

  // PRIMARY: Try tmux injection first (always, if session exists)
  const tmuxResult = tryTmuxInjection(message);
  if (tmuxResult.success) {
    return {
      success: true,
      target: 'cc',
      message,
      method: 'tmux+comms.md',
      note: `Sent directly to tmux session '${tmuxResult.session}'`
    };
  }
  console.log('[Inject] tmux not available:', tmuxResult.reason);

  // SECONDARY: Try AppleScript if directMode is enabled (VS Code fallback)
  if (directMode) {
    const appleResult = tryAppleScriptInjection(message);
    if (appleResult.success) {
      console.log('[Inject] Direct injection to CC via AppleScript succeeded!');
      return { success: true, target: 'cc', message, method: 'applescript+comms.md' };
    } else {
      console.log('[Inject] AppleScript failed:', appleResult.reason);
    }
  }

  // FALLBACK: comms.md only (CC must manually check)
  return {
    success: true,
    target: 'cc',
    message,
    method: 'comms.md',
    note: 'No direct injection available. CC must manually check comms.md. For direct injection, run CC in tmux: tmux new -s claude "claude"'
  };
}

/**
 * Inject a message to Antigravity via ag.js CDP connection
 */
export async function injectToAG(message) {
  return new Promise((resolve) => {
    try {
      const proc = spawn('node', [AG_JS_PATH, 'send', message], {
        cwd: DNA_PATH,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.log('[Inject] Message sent to AG via ag.js');
          resolve({ success: true, target: 'ag', message, output: stdout });
        } else {
          console.error('[Inject] ag.js failed:', stderr);
          resolve({ success: false, target: 'ag', error: stderr || 'ag.js failed' });
        }
      });

      proc.on('error', (error) => {
        console.error('[Inject] Failed to spawn ag.js:', error.message);
        resolve({ success: false, target: 'ag', error: error.message });
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        proc.kill();
        resolve({ success: false, target: 'ag', error: 'Timeout after 30s' });
      }, 30000);
    } catch (error) {
      console.error('[Inject] Error injecting to AG:', error.message);
      resolve({ success: false, target: 'ag', error: error.message });
    }
  });
}

/**
 * Try to inject directly to Codex via tmux send-keys
 * Requires Codex to be running in a tmux session named 'codex' (or CODEX_TMUX_SESSION env var)
 */
function tryCodexTmuxInjection(message, sessionName = CODEX_TMUX_SESSION) {
  if (!checkTmuxSession(sessionName)) {
    return { success: false, method: 'tmux', reason: `tmux session '${sessionName}' not found` };
  }

  try {
    // Escape special characters for tmux
    const escaped = message
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');

    // Send the message - use 1s delay pattern like cc.js
    execSync(`tmux send-keys -t ${sessionName} -- "${escaped}"`, { timeout: 5000 });
    execSync('sleep 1', { timeout: 2000 });
    execSync(`tmux send-keys -t ${sessionName} Enter`, { timeout: 1000 });

    console.log(`[Inject] Direct injection to Codex via tmux session '${sessionName}' succeeded!`);
    return { success: true, method: 'tmux', session: sessionName };
  } catch (error) {
    return { success: false, method: 'tmux', reason: error.message };
  }
}

/**
 * Get status of Codex injection method
 */
export function getCodexInjectionStatus() {
  return {
    tmux: {
      available: checkTmuxSession(CODEX_TMUX_SESSION),
      session: CODEX_TMUX_SESSION,
    },
    comms: {
      available: true,
      path: COMMS_PATH,
    },
  };
}

/**
 * Inject a message to Codex
 * Priority: 1. tmux (PRIMARY) 2. comms.md (FALLBACK)
 */
export async function injectToCodex(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const formatted = `\n[INJECTED] @Codex [${timestamp}]\n${message}\n`;

  // Always log to comms.md for record
  try {
    await appendFile(COMMS_PATH, formatted, 'utf-8');
    console.log('[Inject] Message logged to comms.md');
  } catch (error) {
    console.error('[Inject] Failed to log to comms.md:', error.message);
  }

  // PRIMARY: Try tmux injection
  const tmuxResult = tryCodexTmuxInjection(message);
  if (tmuxResult.success) {
    return {
      success: true,
      target: 'codex',
      message,
      method: 'tmux+comms.md',
      note: `Sent directly to tmux session '${tmuxResult.session}'`
    };
  }
  console.log('[Inject] Codex tmux not available:', tmuxResult.reason);

  // FALLBACK: comms.md only
  return {
    success: true,
    target: 'codex',
    message,
    method: 'comms.md',
    note: 'No direct injection available. Codex must manually check comms.md. For direct injection, run Codex in tmux: ./scripts/start-codex-tmux.sh'
  };
}

/**
 * Inject a message to both CC and AG
 */
export async function injectToBoth(message, directMode = false) {
  const [ccResult, agResult] = await Promise.all([
    injectToCC(message, directMode),
    injectToAG(message),
  ]);

  return {
    success: ccResult.success && agResult.success,
    target: 'both',
    results: { cc: ccResult, ag: agResult },
    message,
  };
}

/**
 * Inject a message to ALL agents (CC, AG, and Codex)
 */
export async function injectToAll(message, directMode = false) {
  const [ccResult, agResult, codexResult] = await Promise.all([
    injectToCC(message, directMode),
    injectToAG(message),
    injectToCodex(message),
  ]);

  return {
    success: ccResult.success && agResult.success && codexResult.success,
    target: 'all',
    results: { cc: ccResult, ag: agResult, codex: codexResult },
    message,
  };
}

/**
 * Main injection function that routes to appropriate target
 */
export async function inject(message, target = 'cc', directMode = false) {
  switch (target.toLowerCase()) {
    case 'cc':
      return injectToCC(message, directMode);
    case 'ag':
      return injectToAG(message);
    case 'codex':
      return injectToCodex(message);
    case 'both':
      return injectToBoth(message, directMode);
    case 'all':
      return injectToAll(message, directMode);
    default:
      return { success: false, error: `Unknown target: ${target}` };
  }
}

/**
 * Get combined injection status for all agents
 */
export function getInjectionStatus() {
  return {
    cc: getCCInjectionStatus(),
    codex: getCodexInjectionStatus(),
    // AG status comes from ag.js - would need CDP check
  };
}

export default { inject, injectToCC, injectToAG, injectToCodex, injectToBoth, injectToAll, getCCInjectionStatus, getCodexInjectionStatus, getInjectionStatus };
