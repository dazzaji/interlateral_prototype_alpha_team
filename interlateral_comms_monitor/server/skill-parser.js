// Skill Parser for Interlateral Comms Monitor
// Phase C - OTEL Eval Pipeline v1.2
// Parses skill execution boundaries and phases from event streams

/**
 * Parse skill execution from events
 * @param {Array} events - Array of events to parse
 * @returns {Object|null} Skill execution object or null if no skill found
 */
export function parseSkillExecution(events) {
  const startMarker = events.find(e =>
    e.content && e.content.includes('[SKILL:') && e.content.includes(':START]')
  );

  if (!startMarker) return null;

  const skillMatch = startMarker.content.match(/\[SKILL:([^:]+):START\]/);
  const skillName = skillMatch ? skillMatch[1] : 'unknown';

  const endMarker = events.find(e =>
    e.content && e.content.includes(`[SKILL:${skillName}:END]`)
  );

  // Filter to skill-windowed events FIRST (FIX #6 - Codex)
  const skillEvents = events.filter(e =>
    e.timestamp >= startMarker.timestamp &&
    (!endMarker || e.timestamp <= endMarker.timestamp)
  );

  return {
    skillName,
    startTime: startMarker.timestamp,
    endTime: endMarker?.timestamp,
    status: endMarker ? 'completed' : 'in_progress',
    events: skillEvents,
    phases: extractPhases(skillEvents, skillName),
    revisionCycles: extractRevisionCycles(skillEvents)
  };
}

/**
 * Extract phases from skill-scoped events (FIX #6 - scoped to skill window)
 */
function extractPhases(skillEvents, skillName) {
  const phases = [];

  // Look for review patterns - now scoped to skill window
  const reviewerEvents = skillEvents.filter(e =>
    e.content && (
      e.content.includes('SUGGESTION') ||
      e.content.includes('APPROVE') ||
      e.content.includes('REQUEST CHANGES')
    )
  );

  const breakerEvents = skillEvents.filter(e =>
    e.content && e.content.includes('FAILURE SCENARIO')
  );

  // Extract verdicts and counts
  if (reviewerEvents.length > 0) {
    phases.push({
      name: 'phase_reviewer',
      events: reviewerEvents,
      attributes: {
        suggestions_count: countSuggestions(reviewerEvents),
        verdict: extractVerdict(reviewerEvents)
      }
    });
  }

  if (breakerEvents.length > 0) {
    phases.push({
      name: 'phase_breaker',
      events: breakerEvents,
      attributes: {
        failures_count: countFailures(breakerEvents),
        verdict: extractVerdict(breakerEvents)
      }
    });
  }

  return phases;
}

/**
 * Count suggestions in events
 */
function countSuggestions(events) {
  let count = 0;
  events.forEach(e => {
    const matches = e.content.match(/SUGGESTION\s*\d*/gi);
    if (matches) count += matches.length;
  });
  return count;
}

/**
 * Count failure scenarios in events
 */
function countFailures(events) {
  let count = 0;
  events.forEach(e => {
    const matches = e.content.match(/FAILURE\s*SCENARIO\s*\d*/gi);
    if (matches) count += matches.length;
  });
  return count;
}

/**
 * Extract revision cycles (v1.0, v1.1, v1.2, etc.) - AG Suggestion #2
 */
function extractRevisionCycles(skillEvents) {
  const cycles = [];
  const versionPattern = /v(\d+\.\d+)/g;

  skillEvents.forEach(event => {
    if (!event.content) return;
    const matches = event.content.match(versionPattern);
    if (matches) {
      matches.forEach(version => {
        if (!cycles.includes(version)) {
          cycles.push(version);
        }
      });
    }
  });

  return {
    versions: cycles.sort(),
    cycle_count: cycles.length,
    final_version: cycles[cycles.length - 1] || 'v1.0'
  };
}

/**
 * Extract verdict from events
 */
function extractVerdict(events) {
  const lastEvent = events[events.length - 1];
  if (lastEvent?.content?.includes('APPROVE')) return 'APPROVE';
  if (lastEvent?.content?.includes('REQUEST CHANGES')) return 'REQUEST_CHANGES';
  return 'UNKNOWN';
}

/**
 * Parse multiple skill executions from event stream
 */
export function parseAllSkillExecutions(events) {
  const executions = [];
  let remainingEvents = [...events];

  while (remainingEvents.length > 0) {
    const execution = parseSkillExecution(remainingEvents);
    if (!execution) break;

    executions.push(execution);

    // Remove processed events
    if (execution.endTime) {
      remainingEvents = remainingEvents.filter(e =>
        e.timestamp > execution.endTime
      );
    } else {
      break; // Skill still in progress
    }
  }

  return executions;
}

/**
 * Extract skill metrics for evaluation
 */
export function extractSkillMetrics(skillExecution) {
  const metrics = {
    skill_name: skillExecution.skillName,
    status: skillExecution.status,
    duration_ms: 0,
    event_count: skillExecution.events.length,
    suggestions_count: 0,
    failures_count: 0,
    revision_count: skillExecution.revisionCycles.cycle_count,
    final_version: skillExecution.revisionCycles.final_version,
    all_approved: false
  };

  // Calculate duration
  if (skillExecution.startTime && skillExecution.endTime) {
    metrics.duration_ms = new Date(skillExecution.endTime) - new Date(skillExecution.startTime);
  }

  // Extract phase metrics
  skillExecution.phases.forEach(phase => {
    if (phase.name === 'phase_reviewer') {
      metrics.suggestions_count = phase.attributes.suggestions_count;
    }
    if (phase.name === 'phase_breaker') {
      metrics.failures_count = phase.attributes.failures_count;
    }
  });

  // Check if all agents approved
  const reviewerApproved = skillExecution.phases.find(p =>
    p.name === 'phase_reviewer' && p.attributes.verdict === 'APPROVE'
  );
  const breakerApproved = skillExecution.phases.find(p =>
    p.name === 'phase_breaker' && p.attributes.verdict === 'APPROVE'
  );
  metrics.all_approved = !!(reviewerApproved && breakerApproved);

  return metrics;
}
