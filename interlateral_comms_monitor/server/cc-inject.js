#!/usr/bin/env node
// cc-inject.js - Direct injection to Claude Code via AppleScript (macOS)
// This sends keystrokes directly to VS Code's terminal

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', '..', 'interlateral_dna', 'comms.md');

/**
 * Inject text directly into VS Code terminal using AppleScript (macOS only)
 * This types the message into whatever terminal is focused in VS Code
 */
function injectViaAppleScript(message) {
  // Escape special characters for AppleScript
  const escaped = message
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

  const script = `
    tell application "Visual Studio Code"
      activate
      delay 0.3
    end tell

    tell application "System Events"
      tell process "Code"
        -- Type the message
        keystroke "${escaped}"
        -- Press Enter to submit
        keystroke return
      end tell
    end tell
  `;

  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
    return { success: true, method: 'applescript' };
  } catch (error) {
    return { success: false, method: 'applescript', error: error.message };
  }
}

/**
 * Alternative: Send via tmux if Claude Code is running in a tmux session
 */
function injectViaTmux(message, sessionName = 'claude') {
  try {
    // Check if tmux session exists
    execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);

    // Send keys to the session
    execSync(`tmux send-keys -t ${sessionName} "${message.replace(/"/g, '\\"')}" Enter`);
    return { success: true, method: 'tmux' };
  } catch (error) {
    return { success: false, method: 'tmux', error: 'tmux session not found or error' };
  }
}

/**
 * Fallback: Append to comms.md (CC must manually check)
 */
function injectViaComms(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const formatted = `\n[INJECTED] @CC [${timestamp}]\n${message}\n`;

  try {
    fs.appendFileSync(LOG_FILE, formatted, 'utf-8');
    return { success: true, method: 'comms.md' };
  } catch (error) {
    return { success: false, method: 'comms.md', error: error.message };
  }
}

/**
 * Try multiple injection methods in order of preference
 */
async function inject(message, preferredMethod = 'auto') {
  const results = [];

  if (preferredMethod === 'applescript' || preferredMethod === 'auto') {
    // Check if we're on macOS
    if (process.platform === 'darwin') {
      const result = injectViaAppleScript(message);
      results.push(result);
      if (result.success) {
        // Also log to comms.md for record
        injectViaComms(message);
        return { ...result, logged: true };
      }
    }
  }

  if (preferredMethod === 'tmux' || preferredMethod === 'auto') {
    const result = injectViaTmux(message);
    results.push(result);
    if (result.success) {
      injectViaComms(message);
      return { ...result, logged: true };
    }
  }

  // Fallback to comms.md
  const result = injectViaComms(message);
  result.note = 'Direct injection failed, message logged to comms.md. CC must manually check.';
  result.attempts = results;
  return result;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const method = args[0] === '--method' ? args[1] : 'auto';
  const message = args[0] === '--method' ? args.slice(2).join(' ') : args.join(' ');

  if (!message) {
    console.log(`
CC Inject - Direct injection to Claude Code
============================================
Usage: node cc-inject.js [--method METHOD] "message"

Methods:
  auto        - Try AppleScript, then tmux, then comms.md (default)
  applescript - macOS AppleScript keystroke injection
  tmux        - tmux send-keys (requires tmux session named 'claude')
  comms       - Append to comms.md only (fallback)

Examples:
  node cc-inject.js "Hello CC!"
  node cc-inject.js --method applescript "Direct message"
`);
    process.exit(0);
  }

  inject(message, method).then(result => {
    console.log(JSON.stringify(result, null, 2));
  });
}

module.exports = { inject, injectViaAppleScript, injectViaTmux, injectViaComms };
