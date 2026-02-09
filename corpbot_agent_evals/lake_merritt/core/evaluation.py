"""
Lake Merritt Evaluation Engine v2.3
Runs LLM-as-judge evaluations on OTEL traces from tri-agent skill executions.

Fixes in v2.3:
- P0: Fail-fast validation for required metadata fields
- P0: Extract structured metadata from resource attributes
- P0: INVALID_DATA sentinel support
- v2.2: Extracts breaker_review/change_log from trace content (Codex issue)
- v2.2: Redacts content at trace level, not just attributes (Codex issue)
"""

import json
import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

from .data_models import EvaluationItem, ScorerResult, EvaluationBatch
from .scoring.llm_judge import LLMJudgeScorer
from .eval_pack.loader import load_eval_pack

# Load .env from repo root
load_dotenv(Path(__file__).parents[3] / '.env')

# P0: Required metadata fields per eval pack (fail-fast validation)
REQUIRED_METADATA = {
    'revision_addressed': ['breaker_review', 'change_log'],
    'reviewer_minimum': [],  # Uses trace content, not specific metadata
    'approval_chain': []     # Uses approvals from trace
}

# P0: Sentinel value for invalid/missing data
INVALID_DATA_SENTINEL = 'INVALID_DATA'

# Sensitive patterns for content redaction
SENSITIVE_PATTERNS = [
    r'sk-[a-zA-Z0-9]{20,}',  # OpenAI API keys
    r'sk-ant-[a-zA-Z0-9-]+',  # Anthropic API keys
    r'OPENAI_API_KEY\s*=\s*\S+',
    r'api[_-]?key\s*[=:]\s*\S+',
    r'password\s*[=:]\s*\S+',
    r'secret\s*[=:]\s*\S+',
    r'token\s*[=:]\s*[a-zA-Z0-9_-]{20,}',
]


def validate_required_metadata(item: EvaluationItem, pack_name: str) -> List[str]:
    """
    P0: Validate that required metadata fields are present and not INVALID_DATA.
    Returns list of missing field names. Empty list = valid.
    """
    pack_base_name = pack_name.lower().replace(' ', '_').split('/')[-1].replace('.yaml', '')
    required_fields = REQUIRED_METADATA.get(pack_base_name, [])

    missing = []
    for field in required_fields:
        value = item.metadata.get(field)
        # Strict validation: None, empty string, or sentinel all fail
        if value is None or value == '' or value == INVALID_DATA_SENTINEL:
            missing.append(field)
        elif isinstance(value, str) and value.startswith(INVALID_DATA_SENTINEL):
            missing.append(field)

    return missing


def create_invalid_result(missing_fields: List[str]) -> ScorerResult:
    """P0: Create a scorer result for invalid/incomplete data."""
    return ScorerResult(
        scorer_name='metadata_validation',
        numeric_score=0.0,
        passed=False,
        reasoning=f"INVALID (Incomplete Data): Missing required fields: {missing_fields}",
        raw_response={'status': 'INVALID', 'missing_fields': missing_fields}
    )


def extract_resource_metadata(trace_data: Dict) -> Dict[str, Any]:
    """P0: Extract structured metadata from OTEL resource attributes."""
    metadata = {}

    for resource_span in trace_data.get('resourceSpans', []):
        if not isinstance(resource_span, dict):
            continue

        resource = resource_span.get('resource', {})
        attrs = resource.get('attributes', [])

        for attr in attrs:
            if not isinstance(attr, dict):
                continue
            key = attr.get('key', '')
            value_obj = attr.get('value', {})

            # Extract metadata.* attributes
            if key.startswith('metadata.'):
                field_name = key[9:]  # Remove 'metadata.' prefix
                for value_type in ['stringValue', 'intValue', 'boolValue', 'doubleValue']:
                    if value_type in value_obj:
                        metadata[field_name] = value_obj[value_type]
                        break

    return metadata


def run_evaluation_batch(
    trace_data: Dict[str, Any],
    pack_path: str
) -> EvaluationBatch:
    """
    Run evaluation on an OTEL trace using the specified eval pack.
    """
    pack = load_eval_pack(pack_path)

    # P0: Extract structured metadata from resource attributes
    resource_metadata = extract_resource_metadata(trace_data)

    # Check evaluation mode (per-span vs whole-trace)
    eval_mode = pack.ingestion.config.get('evaluation_mode', 'span')

    if eval_mode == 'trace':
        # Whole-trace evaluation: single item with full trace as context
        items = [create_trace_level_item(trace_data, resource_metadata)]
    else:
        # Per-span evaluation: one item per span
        items = extract_items_from_trace(trace_data, pack, resource_metadata)

    if not items:
        return EvaluationBatch(
            eval_pack=pack.name,
            items=[],
            summary_stats={'total_items': 0, 'passed': 0, 'failed': 0,
                          'average_score': 0, 'status': 'NO_ITEMS'}
        )

    # P0: Fail-fast validation for required metadata
    for item in items:
        missing = validate_required_metadata(item, pack_path)
        if missing:
            # Mark as invalid immediately
            item.scores.append(create_invalid_result(missing))
            return EvaluationBatch(
                eval_pack=pack.name,
                items=items,
                summary_stats={'total_items': len(items), 'passed': 0, 'failed': len(items),
                              'average_score': 0, 'status': 'INVALID (Incomplete Data)'}
            )

    # Run each scorer in the pipeline
    for stage in pack.pipeline:
        scorer = create_scorer(stage)
        stage_failed = False

        for item in items:
            result = scorer.score(item, stage.config)
            item.scores.append(result)

            # Check on_fail behavior
            if not result.passed and stage.on_fail == 'stop':
                stage_failed = True
                break

        if stage_failed:
            break  # Don't run remaining pipeline stages

    return EvaluationBatch(
        eval_pack=pack.name,
        items=items,
        summary_stats=calculate_summary(items, pack)
    )


def create_trace_level_item(trace_data: Dict, resource_metadata: Dict = None) -> EvaluationItem:
    """Create a single evaluation item containing the full trace."""
    spans = extract_all_spans(trace_data)
    resource_metadata = resource_metadata or {}

    # Build trace summary with content extraction
    trace_summary = []
    all_content = []

    for span in spans:
        attrs = otel_attributes_to_dict(span.get('attributes', []))
        content = attrs.get('content', '')

        # Redact sensitive content (Codex v2.1 issue #2)
        redacted_content = redact_content(content)
        truncated_content = truncate_content(redacted_content, 500)

        if content:
            all_content.append(content)

        trace_summary.append({
            'name': span.get('name'),
            'spanId': span.get('spanId'),
            'startTime': span.get('startTimeUnixNano'),
            'endTime': span.get('endTimeUnixNano'),
            'agent': attrs.get('agent'),
            'content': truncated_content
        })

    # Extract breaker_review and change_log from content (Codex v2.1 issue #1)
    full_content = '\n'.join(all_content)
    breaker_review = extract_breaker_review(full_content)
    change_log = extract_change_log(full_content)

    # P0: Prefer resource metadata over content extraction
    final_breaker_review = resource_metadata.get('breaker_review', breaker_review)
    final_change_log = resource_metadata.get('change_log', change_log)
    final_reviewer_suggestions = resource_metadata.get('reviewer_suggestions', '')
    final_user_prompt = resource_metadata.get('user_prompt', '')

    # P0: Extract approvals from resource metadata
    approvals = []
    if 'approvals' in resource_metadata:
        try:
            approvals = json.loads(resource_metadata['approvals']) if isinstance(resource_metadata['approvals'], str) else resource_metadata['approvals']
        except:
            approvals = []

    all_approved = resource_metadata.get('all_approved', False)

    return EvaluationItem(
        id='trace_evaluation',
        input=redact_content(json.dumps(trace_summary, indent=2)),
        metadata={
            'otel_trace': trace_summary,
            'span_count': len(spans),
            'trace_id': spans[0].get('traceId') if spans else None,
            'breaker_review': final_breaker_review,
            'change_log': final_change_log,
            'reviewer_suggestions': final_reviewer_suggestions,
            'user_prompt': final_user_prompt,
            'approvals': approvals,
            'all_approved': all_approved,
            'data_quality': resource_metadata.get('data_quality', {})
        }
    )


def extract_breaker_review(content: str) -> str:
    """Extract Breaker/failure scenarios from content."""
    # Look for common Breaker review patterns
    patterns = [
        r'(?:FAILURE SCENARIO|FAILURE|Failure scenario)[^\n]*\n((?:.*?\n)*?)(?=\n\n|\Z)',
        r'(?:BREAKER|Breaker)[^\n]*\n((?:.*?\n)*?)(?=\n\n|\Z)',
        r'(?:\[Codex\].*?BREAKER.*?\n)((?:.*?\n)*?)(?=---|\Z)',
        r'(?:REQUEST.?CHANGES|Request Changes)[^\n]*\n((?:.*?\n)*?)(?=\n\n|\Z)',
    ]

    reviews = []
    for pattern in patterns:
        matches = re.findall(pattern, content, re.IGNORECASE | re.MULTILINE)
        reviews.extend(matches)

    if reviews:
        return truncate_content('\n'.join(reviews), 2000)
    return 'No breaker review found in trace'


def extract_change_log(content: str) -> str:
    """Extract change log/revision information from content."""
    patterns = [
        r'(?:Change Log|CHANGE LOG|Changelog)[^\n]*\n((?:.*?\n)*?)(?=\n\n|\Z)',
        r'(?:v\d+\.\d+.*?(?:FIXED|Fixed|Addressed|DONE).*?\n)((?:.*?\n)*?)(?=\n\n|\Z)',
        r'(?:Revision|REVISION)[^\n]*\n((?:.*?\n)*?)(?=\n\n|\Z)',
        r'(?:Issues? (?:fixed|addressed|resolved))[^\n]*\n((?:.*?\n)*?)(?=\n\n|\Z)',
    ]

    logs = []
    for pattern in patterns:
        matches = re.findall(pattern, content, re.IGNORECASE | re.MULTILINE)
        logs.extend(matches)

    if logs:
        return truncate_content('\n'.join(logs), 2000)
    return 'No change log found in trace'


def extract_all_spans(trace_data: Dict) -> List[Dict]:
    """Extract all spans from trace, handling missing keys gracefully."""
    spans = []

    for resource_span in trace_data.get('resourceSpans', []):
        if not isinstance(resource_span, dict):
            continue

        scope_spans = resource_span.get('scopeSpans')
        if not scope_spans:
            continue

        for scope_span in scope_spans:
            if not isinstance(scope_span, dict):
                continue
            span_list = scope_span.get('spans', [])
            if span_list:
                spans.extend(span_list)

    return spans


def otel_attributes_to_dict(attributes: List[Dict]) -> Dict[str, Any]:
    """
    Convert OTEL attributes list to dict.

    OTEL format: [{"key": "foo", "value": {"stringValue": "bar"}}]
    Output: {"foo": "bar"}
    """
    result = {}
    if not isinstance(attributes, list):
        return result

    for attr in attributes:
        if not isinstance(attr, dict):
            continue
        key = attr.get('key')
        value_obj = attr.get('value', {})
        if key and isinstance(value_obj, dict):
            for value_type in ['stringValue', 'intValue', 'boolValue', 'doubleValue']:
                if value_type in value_obj:
                    result[key] = value_obj[value_type]
                    break
    return result


def extract_items_from_trace(trace_data: Dict, pack, resource_metadata: Dict = None) -> List[EvaluationItem]:
    """Extract evaluation items from OTEL trace based on pack config."""
    items = []
    spans = extract_all_spans(trace_data)
    resource_metadata = resource_metadata or {}

    input_field = pack.ingestion.config.get('input_field', 'attributes.content')

    # Also collect all content for metadata extraction
    all_content = []

    for i, span in enumerate(spans):
        attrs = otel_attributes_to_dict(span.get('attributes', []))

        if input_field == 'attributes.content':
            content = attrs.get('content')
        else:
            content = extract_nested_field(span, input_field)

        if content:
            all_content.append(content)

            # Redact sensitive content
            redacted_content = redact_content(content)

            items.append(EvaluationItem(
                id=f"span_{i}",
                input=truncate_content(redacted_content, 2000),
                metadata={
                    'span_name': span.get('name'),
                    'span_id': span.get('spanId'),
                    'trace_id': span.get('traceId'),
                    'attributes': redact_sensitive_attrs(attrs)
                }
            ))

    # Extract and add breaker_review/change_log to all items
    full_content = '\n'.join(all_content)
    breaker_review = extract_breaker_review(full_content)
    change_log = extract_change_log(full_content)

    # P0: Prefer resource metadata over content extraction
    final_breaker_review = resource_metadata.get('breaker_review', breaker_review)
    final_change_log = resource_metadata.get('change_log', change_log)
    final_reviewer_suggestions = resource_metadata.get('reviewer_suggestions', '')

    for item in items:
        item.metadata['breaker_review'] = final_breaker_review
        item.metadata['change_log'] = final_change_log
        item.metadata['reviewer_suggestions'] = final_reviewer_suggestions

    return items


def extract_nested_field(obj: Dict, field_path: str) -> Optional[str]:
    """Extract nested field from object using dot notation."""
    parts = field_path.split('.')
    current = obj
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current if isinstance(current, str) else None


def truncate_content(content: str, max_chars: int) -> str:
    """Truncate content to prevent prompt size issues."""
    if not content or len(content) <= max_chars:
        return content or ''
    return content[:max_chars] + f"\n... [TRUNCATED - {len(content) - max_chars} chars removed]"


def redact_content(content: str) -> str:
    """Redact sensitive patterns from content (Codex v2.1 issue #2)."""
    if not content:
        return content

    redacted = content
    for pattern in SENSITIVE_PATTERNS:
        redacted = re.sub(pattern, '[REDACTED]', redacted, flags=re.IGNORECASE)
    return redacted


def redact_sensitive_attrs(attrs: Dict) -> Dict:
    """Redact potentially sensitive data from attributes."""
    sensitive_keys = {'api_key', 'password', 'secret', 'token', 'credential', 'auth'}
    redacted = {}
    for key, value in attrs.items():
        if any(s in key.lower() for s in sensitive_keys):
            redacted[key] = '[REDACTED]'
        elif isinstance(value, str):
            redacted[key] = redact_content(value)
        else:
            redacted[key] = value
    return redacted


def create_scorer(stage):
    """Create scorer instance based on stage config."""
    if stage.scorer == 'llm_judge':
        return LLMJudgeScorer()
    raise ValueError(f"Unknown scorer: {stage.scorer}")


def calculate_summary(items: List[EvaluationItem], pack) -> Dict:
    """Calculate summary statistics from scored items."""
    if not items:
        return {'total_items': 0, 'passed': 0, 'failed': 0, 'average_score': 0, 'status': 'NO_ITEMS'}

    total = len(items)
    passed = sum(1 for item in items if item.scores and all(s.passed for s in item.scores))
    failed = total - passed

    all_scores = [s.numeric_score for item in items for s in item.scores if s.numeric_score is not None]
    avg_score = sum(all_scores) / len(all_scores) if all_scores else 0

    return {
        'total_items': total,
        'passed': passed,
        'failed': failed,
        'average_score': round(avg_score, 3),
        'status': 'PASS' if passed == total else 'PARTIAL' if passed > 0 else 'FAIL'
    }
