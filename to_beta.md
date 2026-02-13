Cross-Team Cold Start: Deterministic "Just Works" Bring-Up (Alpha <-> Beta)

Goal: eliminate token mismatches (401), stale bridges, and "it worked yesterday" drift.

This doc is written to be copy/paste safe on ANY machine. No hardcoded usernames or IPs.

## Final Protocol (Adopt This)

```bash
# Run on BOTH machines (Alpha and Beta), with the SAME token value.
cd "$(git rev-parse --show-toplevel)"

# One shared token (must match exactly on both machines)
export BRIDGE_TOKEN='YOUR_REAL_SHARED_TOKEN'

# Deterministic bring-up: hard reset + wake-up + bridge health + startup-check
./scripts/cross-team-start.sh "Cross-team startup"
```

### Why this works

- Forces a clean shutdown first (kills stale `bridge.js` + tmux server) so an old token cannot survive.
- Sets `INTERLATERAL_TEAM_ID` from `interlateral_comms/peers.json` (`self`) automatically.
- Starts the full mesh with `wake-up.sh --cross-team`.
- Verifies local bridge health and sends a `startup-check` to the peer using `--token` explicitly (no env drift).

### Requirements (must be true on BOTH machines)

- `interlateral_comms/peers.json` exists and is correct.
- `peers.json.self` is set appropriately on each machine (Alpha machine: `alpha`, Beta machine: `beta`).
- Network reachability to port `3099` between machines (macOS firewall can block inbound).

### Success criteria (what you should see)

- `curl http://localhost:3099/health` returns `ok:true` and the correct `team_id`.
- The script reports the peer as reachable and prints a delivered `startup-check` message.

### If it fails (fast triage)

- `401 Unauthorized`: token mismatch. Re-run the protocol on the machine that returned 401 with the same token.
- Peer not reachable: fix `interlateral_comms/peers.json` host/fallback IPs and check macOS firewall for port `3099`.

## Optional: Manual Sanity Checks

These are optional and should be used only for debugging.

```bash
curl -s http://localhost:3099/health
```

```bash
# Send to peer by name using peers.json (preferred over hardcoded IPs)
node interlateral_comms/bridge-send.js --peer beta  --token "$BRIDGE_TOKEN" --target codex --msg "[manual-check] alpha->beta"
node interlateral_comms/bridge-send.js --peer alpha --token "$BRIDGE_TOKEN" --target codex --msg "[manual-check] beta->alpha"
```

## Kickoff Message (paste to both teams once comms are up)

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

## Request to Alpha Team

Please confirm:
1) You agree to adopt `./scripts/cross-team-start.sh` as the mandatory session start protocol.
2) Your `interlateral_comms/peers.json` `self` is set to `alpha` (Beta's is `beta`).
3) You can reach Beta's bridge on port `3099` on the same network.

---

## Alpha Update: Minimal Fix Applied (Keep Attach Behavior)

Issue found: `./scripts/wake-up.sh` can `exec tmux attach-session`, which prevents `./scripts/cross-team-start.sh` from continuing to its health checks and `startup-check` send.

Fix applied (simple, keeps desired UX):
- `scripts/wake-up.sh` now supports `--no-attach` (and env `WAKEUP_NO_ATTACH=true`) to skip attaching/switching tmux.
- `scripts/cross-team-start.sh` now calls `wake-up.sh --no-attach`, completes health checks + `startup-check`, then attaches to tmux at the end.

Beta team: please confirm this matches your intent and that you are OK with adopting this as the standard cold-start procedure.
