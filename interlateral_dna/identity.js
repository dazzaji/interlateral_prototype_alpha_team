#!/usr/bin/env node
/**
 * Shared identity/session helpers for inter-agent messaging.
 * Ensures messages carry stable provenance across machine/team/session.
 */

const os = require('os');

function getIdentity() {
  const hostname = os.hostname();
  const team = process.env.INTERLATERAL_TEAM_ID || process.env.TEAM_ID || 'alpha';
  const sessionId =
    process.env.INTERLATERAL_SESSION_ID ||
    process.env.OTEL_SESSION_ID ||
    `session_${Date.now()}`;
  const sender = process.env.INTERLATERAL_SENDER || 'unknown';
  return { hostname, team, sessionId, sender };
}

function identityStamp() {
  const id = getIdentity();
  return `[ID team=${id.team} sender=${id.sender} host=${id.hostname} sid=${id.sessionId}]`;
}

function stampMessage(message) {
  if (process.env.INTERLATERAL_DISABLE_STAMP === 'true') return message;
  if (typeof message !== 'string' || message.length === 0) return message;
  if (message.startsWith('[ID ')) return message;
  return `${identityStamp()} ${message}`;
}

function logActor(defaultActor = 'Unknown') {
  const sender = process.env.INTERLATERAL_SENDER || defaultActor;
  return sender;
}

module.exports = {
  getIdentity,
  identityStamp,
  stampMessage,
  logActor,
};

