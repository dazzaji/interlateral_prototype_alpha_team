# OTEL Trace Validity Rules (P2.3)

**Version:** 1.0
**Date:** 2026-01-25
**Status:** Active for Test #2

---

## Purpose

This document defines the validity rules for OTEL traces used in Lake Merritt evaluations. A trace that does not meet these rules will be marked as `INVALID (Incomplete Data)` by the evaluation engine.

---

## 1. Session Boundaries

### 1.1 Required

Every valid OTEL trace MUST have defined session boundaries:

```json
{
  "session_boundaries": {
    "start": "2026-01-25T22:00:00Z",  // ISO 8601 timestamp
    "end": "2026-01-25T23:00:00Z",    // ISO 8601 timestamp
    "source": "session_state.json"    // How boundaries were determined
  }
}
```

### 1.2 Boundary Sources (in order of preference)

1. **session_state.json** - Byte offset recording (P0 v5 approach)
2. **events.jsonl** - Skill start/end markers
3. **Fallback** - Last N minutes (marks data_quality as degraded)

### 1.3 Invalid If

- `start` or `end` is null/missing
- `end` is before `start`
- Time window exceeds 24 hours (likely cross-session contamination)

---

## 2. Structured Metadata Fields

### 2.1 Required Fields by Eval Pack

| Eval Pack | Required Metadata | Fail-Fast Behavior |
|-----------|-------------------|-------------------|
| `revision_addressed` | `breaker_review`, `change_log` | INVALID if missing |
| `reviewer_minimum` | (none) | Uses trace content |
| `approval_chain` | (none) | Uses spans and approvals |

### 2.2 Metadata Field Definitions

| Field | Type | Description | Sentinel Value |
|-------|------|-------------|----------------|
| `breaker_review` | string | Extracted Breaker/CX feedback | `INVALID_DATA` |
| `reviewer_suggestions` | string | Extracted Reviewer/AG suggestions | `INVALID_DATA` |
| `change_log` | string | Revision history | `INVALID_DATA` |
| `user_prompt` | string | Original assignment text | `INVALID_DATA` |
| `approvals` | array | List of agent verdicts | `[]` |
| `all_approved` | boolean | True if all agents approved | `false` |
| `declines` | array | List of declined items | `[]` |
| `declined_items_count` | integer | Count of declined items | `0` |

### 2.3 Sentinel Value Handling

The sentinel value `INVALID_DATA` indicates the field could not be extracted from authoritative sources.

**Validation rule:**
```python
def is_valid_metadata(value):
    if value is None or value == '' or value == 'INVALID_DATA':
        return False
    if isinstance(value, str) and value.startswith('INVALID_DATA'):
        return False
    return True
```

---

## 3. Data Quality Indicators

### 3.1 Required

Every trace MUST include data quality indicators:

```json
{
  "data_quality": {
    "cc_telemetry": "OK",        // OK | EMPTY | NOT_FOUND | ERROR
    "codex_telemetry": "OK",
    "ag_telemetry": "OK",
    "events_jsonl": "OK"
  }
}
```

### 3.2 Quality Statuses

| Status | Meaning | Impact |
|--------|---------|--------|
| `OK` | Data successfully extracted | Full evaluation |
| `EMPTY` | File exists but no content in session window | Partial evaluation |
| `NOT_FOUND` | File does not exist | May degrade to INVALID |
| `ERROR` | Read/parse error | May degrade to INVALID |

### 3.3 Degraded Evaluation

If `data_quality` shows problems:
- Single source `NOT_FOUND` or `ERROR`: Warning, continue with available data
- All sources `NOT_FOUND`/`ERROR`: Mark trace as INVALID

---

## 4. Span Requirements

### 4.1 Minimum Spans

A valid trace SHOULD have at least 1 span. Zero spans results in `NO_ITEMS` status.

### 4.2 Span Attributes

Each span MUST have:
- `traceId` - Shared across all spans in the trace
- `spanId` - Unique within the trace
- `startTimeUnixNano` - Nanosecond timestamp
- `name` - Event type/name

SHOULD have:
- `attributes.content` - Message content
- `attributes.agent` - Agent identifier (CC, AG, CX)

---

## 5. Resource Attributes

### 5.1 Required Resource Attributes

The trace resource MUST include:

```json
{
  "resource": {
    "attributes": [
      { "key": "service.name", "value": { "stringValue": "interlateral" } },
      { "key": "skill.name", "value": { "stringValue": "dev-collaboration" } },
      { "key": "session.id", "value": { "stringValue": "test2_20260125_230500" } }
    ]
  }
}
```

### 5.2 Structured Metadata in Resource

P0 traces SHOULD include structured metadata as resource attributes:

```json
{ "key": "metadata.breaker_review", "value": { "stringValue": "..." } },
{ "key": "metadata.reviewer_suggestions", "value": { "stringValue": "..." } },
{ "key": "metadata.change_log", "value": { "stringValue": "..." } },
{ "key": "metadata.user_prompt", "value": { "stringValue": "..." } },
{ "key": "metadata.all_approved", "value": { "boolValue": true } }
```

---

## 6. Validation Flow

```
1. Check session_boundaries exist and are valid
   └─ Invalid → INVALID (Incomplete Data)

2. Extract resource metadata
   └─ Store in resource_metadata dict

3. Check data_quality indicators
   └─ All NOT_FOUND/ERROR → INVALID (Incomplete Data)

4. Validate required metadata for eval pack
   └─ Missing required fields → INVALID (Incomplete Data)

5. Proceed to LLM-as-judge scoring
   └─ Score and return results
```

---

## 7. Example Valid Trace

See `.observability/traces/` for example traces generated by `scripts/export-skill-run.sh --from-session`.

---

## 8. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-25 | Initial P2.3 documentation for Test #2 |
