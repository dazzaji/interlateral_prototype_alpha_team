# Graceful Shutdown - All Agents

## Copy-Paste This (Single Command)

```bash
./scripts/end-session.sh 2>/dev/null; tmux kill-session -t codex 2>/dev/null; tmux kill-session -t claude 2>/dev/null; pkill -f "Antigravity" 2>/dev/null; sleep 2; echo "=== Shutdown Complete ==="; tmux list-sessions 2>/dev/null || echo "No tmux sessions"; curl -s http://127.0.0.1:9222/json/list >/dev/null 2>&1 && echo "WARNING: AG still running" || echo "AG stopped"
```

## What It Does

1. Ends current session (saves state)
2. Kills Codex tmux session
3. Kills CC tmux session
4. Stops Antigravity
5. Waits 2 seconds
6. Verifies everything is stopped

## After Shutdown - Cold Start Test 4A

```bash
./scripts/wake-up.sh --dangerously-skip-permissions "Open README.md. Find the Wake-Up Protocol. Execute it exactly. Get ACK from AG and Codex and all THREE OF YOU ASK ME WHAT THE ASSIGNMENT IS."
```
