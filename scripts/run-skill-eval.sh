#!/bin/bash
# Run evaluation on a skill execution trace
# v2.2: Real LLM-as-judge with all Codex fixes applied

set -e

TRACE_FILE=$1
EVAL_PACK=${2:-"revision_addressed"}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

# v2.2: Security check - ensure .env is gitignored
if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
  echo "WARNING: .env not in .gitignore - adding it now"
  echo ".env" >> .gitignore
fi

if git ls-files --error-unmatch .env 2>/dev/null; then
  echo "ERROR: .env is tracked by git! Run: git rm --cached .env"
  exit 1
fi

# Check for .env file
if [ ! -f "$REPO_ROOT/.env" ]; then
  echo "ERROR: .env file not found at $REPO_ROOT/.env"
  echo ""
  echo "Create it with:"
  echo "  echo 'OPENAI_API_KEY=sk-proj-your-key-here' > $REPO_ROOT/.env"
  exit 1
fi

# Check for Python dependencies (including v2.2 additions)
python3 -c "import openai, yaml, pydantic, dotenv, jinja2, tenacity" 2>/dev/null
if [ $? -ne 0 ]; then
  echo "ERROR: Missing Python dependencies"
  echo ""
  echo "Run: pip install openai pyyaml pydantic python-dotenv jinja2 tenacity"
  exit 1
fi

# Resolve trace file path (v1.2 fix: handle both absolute and relative)
if [[ "$TRACE_FILE" == /* ]]; then
  TRACE_FILE_ABS="$TRACE_FILE"
else
  TRACE_FILE_ABS="$REPO_ROOT/$TRACE_FILE"
fi

if [ ! -f "$TRACE_FILE_ABS" ]; then
  echo "ERROR: Trace file not found: $TRACE_FILE_ABS"
  exit 1
fi

# Output locations
LAKE_MERRITT_DIR="$REPO_ROOT/corpbot_agent_evals/lake_merritt"
EVALS_DIR="$REPO_ROOT/.observability/evals"
JSON_OUTPUT="${EVALS_DIR}/${EVAL_PACK}_${TIMESTAMP}.json"
MD_OUTPUT="${EVALS_DIR}/${EVAL_PACK}_${TIMESTAMP}.md"

EVAL_PACK_FILE="$LAKE_MERRITT_DIR/examples/eval_packs/${EVAL_PACK}.yaml"

if [ ! -f "$EVAL_PACK_FILE" ]; then
  echo "ERROR: Eval pack not found: $EVAL_PACK_FILE"
  echo ""
  echo "Available eval packs:"
  ls -1 "$LAKE_MERRITT_DIR/examples/eval_packs/"*.yaml 2>/dev/null | xargs -n1 basename | sed 's/.yaml$//'
  exit 1
fi

mkdir -p "$EVALS_DIR"

echo "=== Running Skill Evaluation (v2.2 - Real LLM) ==="
echo "Trace: $TRACE_FILE_ABS"
echo "Eval Pack: $EVAL_PACK"
echo ""

# Run REAL evaluation
cd "$LAKE_MERRITT_DIR"
python3 << PYTHON_SCRIPT
import json
import sys
sys.path.insert(0, '.')
from pathlib import Path
from core.evaluation import run_evaluation_batch

trace_file = Path('${TRACE_FILE_ABS}')
json_output = Path('${JSON_OUTPUT}')
md_output = Path('${MD_OUTPUT}')
pack_path = 'examples/eval_packs/${EVAL_PACK}.yaml'

print(f"Loading trace from {trace_file}...")
with open(trace_file) as f:
    trace_data = json.load(f)

print(f"Running evaluation with {pack_path}...")
results = run_evaluation_batch(trace_data, pack_path)

# JSON output
with open(json_output, 'w') as f:
    json.dump(results.model_dump(), f, indent=2, default=str)

# Markdown output
with open(md_output, 'w') as f:
    f.write(results.to_markdown())

print("")
print(f"Status: {results.summary_stats['status']}")
print(f"Score: {results.summary_stats['average_score']}")
print(f"Passed: {results.summary_stats['passed']}/{results.summary_stats['total_items']}")
PYTHON_SCRIPT

echo ""
echo "JSON report: $JSON_OUTPUT"
echo "Markdown report: $MD_OUTPUT"
