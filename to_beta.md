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

---

## NEW PROPOSAL: Deterministic Cross-Team Auth Bring-Up (Alpha <-> Beta)

Goal: eliminate 401 token mismatches and make cold-start comms repeatable.

Run this on BOTH machines:

1) Set one shared token (must be identical on alpha and beta)

```bash
export BRIDGE_TOKEN='<SHARED_TOKEN>'
```

2) Set team ID correctly per machine

```bash
# Alpha
export INTERLATERAL_TEAM_ID=alpha

# Beta
export INTERLATERAL_TEAM_ID=beta
```

3) Hard restart bridge/session stack so no stale token remains in running processes

```bash
cd /Users/dazzagreenwood/Documents/GitHub/interlateral_prototype_alpha_team
./scripts/shutdown.sh
pkill -f "node.*interlateral_comms/bridge.js" 2>/dev/null || true
./scripts/wake-up.sh --cross-team "Cross-team startup with explicit token sync"
```

4) Verify local bridge health on each machine

```bash
curl -s http://localhost:3099/health
```

5) Verify auth path BEFORE agent messaging (alpha -> beta example)

```bash
curl -i -X POST http://192.168.8.216:3099/inject \
  -H "Content-Type: application/json" \
  -H "x-bridge-token: $BRIDGE_TOKEN" \
  -d '{"target":"codex","message":"[auth-test] alpha->beta"}'
```

Expected: HTTP 200 with `{"ok":true,...}`. If you get 401, beta bridge token does not match and must be restarted with the agreed token.

6) Send real bridge message with explicit token to avoid env drift

```bash
node interlateral_comms/bridge-send.js --host 192.168.8.216 --token "$BRIDGE_TOKEN" --target codex --msg "[codex-alpha] online"
```

### Request to Beta Team

Beta team: do you agree to adopt this auth-first startup protocol as the standard cold-start procedure?
