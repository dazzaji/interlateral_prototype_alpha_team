"""
LLM-as-Judge Scorer v2.2
Makes real OpenAI API calls with retry logic and proper templating.

Fixes in v2.2:
- Retry includes APIError, Timeout, InternalServerError (Codex issue #3)
"""

import json
import os
from typing import Dict, Any
from jinja2 import Environment, BaseLoader
from openai import OpenAI, APIError, RateLimitError, APIConnectionError, APITimeoutError, InternalServerError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from ..data_models import EvaluationItem, ScorerResult

# Retry configuration
MAX_RETRIES = 3
RETRY_WAIT_MIN = 1  # seconds
RETRY_WAIT_MAX = 10  # seconds
REQUEST_TIMEOUT = 60  # seconds

# Prompt size limits
MAX_PROMPT_CHARS = 100000  # ~25k tokens


class LLMJudgeScorer:
    """Scores items using LLM-as-judge via OpenAI API with retry logic."""

    def __init__(self):
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError(
                "OPENAI_API_KEY not found. "
                "Create .env file in repo root with: OPENAI_API_KEY=sk-..."
            )

        self.client = OpenAI(api_key=api_key, timeout=REQUEST_TIMEOUT)
        self.jinja_env = Environment(loader=BaseLoader(), autoescape=False)

        # Add tojson filter for Jinja2
        self.jinja_env.filters['tojson'] = lambda x: json.dumps(x, indent=2, default=str)

    def score(self, item: EvaluationItem, config: Dict[str, Any]) -> ScorerResult:
        """Score an item using LLM judgment with retry logic."""
        model = config.get('model', 'gpt-4o')
        temperature = config.get('temperature', 0.0)
        threshold = config.get('threshold', 0.7)

        # Build prompt using Jinja2
        system_prompt = config.get('system_prompt', 'You are an evaluation judge. Return JSON with "score" (0.0-1.0) and "reasoning" fields.')
        user_template = config.get('user_prompt_template', '{{ input }}')

        try:
            user_prompt = self._render_template(user_template, item)
        except Exception as e:
            return ScorerResult(
                scorer_name='llm_judge',
                numeric_score=0.0,
                passed=False,
                reasoning=f"Template rendering failed: {str(e)}",
                raw_response={'error': str(e)}
            )

        # Check prompt size
        total_prompt_size = len(system_prompt) + len(user_prompt)
        if total_prompt_size > MAX_PROMPT_CHARS:
            return ScorerResult(
                scorer_name='llm_judge',
                numeric_score=0.0,
                passed=False,
                reasoning=f"Prompt too large: {total_prompt_size} chars (max {MAX_PROMPT_CHARS})",
                raw_response={'error': 'prompt_too_large', 'size': total_prompt_size}
            )

        # Make API call with retry
        try:
            result_json = self._call_api_with_retry(model, temperature, system_prompt, user_prompt)

            # Extract score from response
            score = result_json.get('score', result_json.get('overall_score', 0.5))
            reasoning = result_json.get('reasoning', json.dumps(result_json))

            # Handle case where score is not a number
            try:
                score = float(score)
            except (TypeError, ValueError):
                score = 0.5

            return ScorerResult(
                scorer_name='llm_judge',
                numeric_score=score,
                passed=score >= threshold,
                reasoning=str(reasoning),
                raw_response=result_json
            )

        except Exception as e:
            return ScorerResult(
                scorer_name='llm_judge',
                numeric_score=0.0,
                passed=False,
                reasoning=f"LLM call failed after retries: {str(e)}",
                raw_response={'error': str(e)}
            )

    def _render_template(self, template_str: str, item: EvaluationItem) -> str:
        """Render Jinja2 template with item data."""
        template = self.jinja_env.from_string(template_str)

        # Build context with all available data
        context = {
            'input': item.input or '',
            'metadata': item.metadata or {},
            'id': item.id,
            'expected_output': item.expected_output or '',
        }

        # Add common metadata shortcuts (P0: expanded list)
        if item.metadata:
            context['breaker_review'] = item.metadata.get('breaker_review', 'No breaker review found')
            context['change_log'] = item.metadata.get('change_log', 'No change log found')
            context['reviewer_suggestions'] = item.metadata.get('reviewer_suggestions', 'No reviewer suggestions found')
            context['user_prompt'] = item.metadata.get('user_prompt', 'No user prompt found')
            context['otel_trace'] = item.metadata.get('otel_trace', [])
            context['attributes'] = item.metadata.get('attributes', {})
            context['approvals'] = item.metadata.get('approvals', [])
            context['all_approved'] = item.metadata.get('all_approved', False)
            context['data_quality'] = item.metadata.get('data_quality', {})

        return template.render(**context)

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=RETRY_WAIT_MIN, max=RETRY_WAIT_MAX),
        retry=retry_if_exception_type((
            RateLimitError,
            APIConnectionError,
            APITimeoutError,      # Added for Codex issue #3
            InternalServerError,  # Added for Codex issue #3 (5xx errors)
            APIError,             # Added for Codex issue #3 (general API errors)
        ))
    )
    def _call_api_with_retry(self, model: str, temperature: float,
                             system_prompt: str, user_prompt: str) -> Dict:
        """Make OpenAI API call with retry on transient errors."""
        response = self.client.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )

        result_text = response.choices[0].message.content
        return json.loads(result_text)
