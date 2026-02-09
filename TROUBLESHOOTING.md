# Troubleshooting

## tmux copy/paste issues
- Ensure you are not inside another tmux session when launching the mesh.
- Try restarting tmux: `tmux kill-server` (only if safe to do so).
- If paste fails in a pane, use `tmux set-option -g set-clipboard on`.

## CDP connection refused (AG)
- Verify Antigravity is running with `--remote-debugging-port=9222`.
- Check CDP status: `curl -s http://127.0.0.1:9222/json/list`.
- If not running, launch Antigravity via CLI or app and retry.

## Agent timeout issues
- Confirm all tmux sessions exist: `tmux has-session -t interlateral-claude` (and codex/gemini).
- Increase timeout in leadership.json if needed for slower machines.
- Re-run `./scripts/wake-up.sh` to reinitialize the mesh.
