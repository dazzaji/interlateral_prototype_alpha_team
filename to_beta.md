Cross-Team Full Reset + Reboot + Project Kickoff

Run this procedure on BOTH Alpha and Beta machines.

1) Clean shutdown

```bash
cd /Users/dazzagreenwood/Documents/GitHub/interlateral_prototype_alpha_team
./scripts/shutdown.sh
pkill -f "node.*interlateral_comms/bridge.js" 2>/dev/null || true
tmux -S /tmp/interlateral-tmux.sock kill-server 2>/dev/null || true
```

2) Fresh startup (Alpha)

```bash
cd /Users/dazzagreenwood/Documents/GitHub/interlateral_prototype_alpha_team
export INTERLATERAL_TEAM_ID=alpha
export BRIDGE_TOKEN=interlateral-2026
./scripts/wake-up.sh --cross-team "Cross-team project kickoff: collaborate on <PROJECT_NAME>. Confirm ACKs and coordinate through bridge."
```

3) Fresh startup (Beta)

```bash
cd /Users/dazzagreenwood/Documents/GitHub/interlateral_prototype_alpha_team
export INTERLATERAL_TEAM_ID=beta
export BRIDGE_TOKEN=interlateral-2026
./scripts/wake-up.sh --cross-team "Cross-team project kickoff: collaborate on <PROJECT_NAME>. Confirm ACKs and coordinate through bridge."
```

4) Quick comms verification (both sides)

```bash
curl -s http://localhost:3099/health
```

Optional direct ping check:

```bash
# From Alpha -> Beta
node interlateral_comms/bridge-send.js --host 192.168.8.216 --target cc --msg "[COORD] Alpha online and ready."

# From Beta -> Alpha (replace with Alpha IP if needed)
node interlateral_comms/bridge-send.js --host 192.168.8.124 --target cc --msg "[COORD] Beta online and ready."
```

5) Kickoff message to both teams

Paste this to both teams:

```text
Assignment: <PROJECT_NAME>

Cross-team mode is now active. Alpha and Beta should collaborate as one mesh.
Protocol:
1) ACK this assignment on both teams.
2) Share plan and split work clearly.
3) Exchange progress updates over bridge with identity stamps.
4) Request/perform cross-team reviews before finalizing.
5) Report completion with: deliverables, test evidence, open risks.
```

