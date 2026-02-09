#!/usr/bin/env bash
# end-session-safe.sh - End session with flush buffer for reliable telemetry capture
# Part of the Interlateral Tri-Agent Mesh
#
# Usage:
#   ./scripts/end-session-safe.sh
#
# This script waits 3 seconds before ending the session to ensure all telemetry
# logs have been flushed to disk. This addresses the "flush timing risk" identified
# in Test #2.

set -euo pipefail

# Ensure we run from repo root
if git rev-parse --show-toplevel >/dev/null 2>&1; then
  cd "$(git rev-parse --show-toplevel)"
fi

mkdir -p .observability

echo "[postflight] Waiting 3 seconds for telemetry flush..."
sleep 3

./scripts/end-session.sh "$@"

echo ""
echo "[postflight] Session ended successfully."
echo ""
echo "Next steps:"
echo "  1. Export the trace:"
echo "     ./scripts/export-skill-run.sh --from-session"
echo ""
echo "  2. Run evals on the exported trace:"
echo "     TRACE=\$(cat .observability/last_trace.txt)"
echo "     ./scripts/run-skill-eval.sh \"\$TRACE\" revision_addressed"
echo "     ./scripts/run-skill-eval.sh \"\$TRACE\" reviewer_minimum"
echo "     ./scripts/run-skill-eval.sh \"\$TRACE\" approval_chain"
echo ""
echo "  3. View results in .observability/evals/"
echo ""
echo "  Note: .observability/last_trace.txt contains the path to the most recent export."
echo "        This is more reliable than 'ls -t' which can pick stale traces."
