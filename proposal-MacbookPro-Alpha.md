# Proposal: Zero-Config Cross-Machine Bridge Discovery

**Date:** 2026-02-11
**Author:** CC (Alpha Team)
**Status:** PROPOSAL — awaiting human approval

---

## Problem Statement

The cross-machine REST API bridge (`interlateral_comms/bridge.js`) works — 6/6 tests passed between Alpha (MacBook Air) and Beta (MacBook Pro). But it relies on **hardcoded WiFi IP addresses** (e.g., `192.168.8.124`, `192.168.8.216`) that are assigned by DHCP and change unpredictably between sessions.

This means:

1. **Every cold start requires IP hunting.** Someone has to run `ipconfig getifaddr en0` on each machine, then manually update commands or tell agents the new IPs.
2. **No agent can autonomously establish cross-machine comms.** The wake-up protocol can bootstrap local agents, but it cannot connect to a peer team's bridge without knowing the IP in advance.
3. **Tailscale IPs are stable but unreliable.** Testing showed Tailscale works Alpha→Beta but times out Beta→Alpha. It's not a dependable primary path.
4. **The system breaks the "cold start" principle.** The whole point of the mesh template is that agents wake up and get to work. Requiring a human to find and paste IP addresses on every boot defeats that goal.

**Bottom line:** The bridge architecture is sound, but the addressing layer is fragile. We need stable, zero-config peer resolution.

---

## Proposed Solution: mDNS Hostnames + peers.json

macOS has **built-in mDNS/Bonjour** support. Every Mac advertises a `.local` hostname that resolves to its current WiFi IP automatically — no setup, no service to run, no infrastructure.

| Machine | .local Hostname | Resolves To |
|---------|----------------|-------------|
| Alpha (MacBook Air) | `Dazzas-MacBook-Air.local` | Current WiFi IP (e.g., 192.168.8.124 today, something else tomorrow) |
| Beta (MacBook Pro) | `<Beta-LocalHostName>.local` | Current WiFi IP (e.g., 192.168.8.216 today, something else tomorrow) |

The `.local` hostname is stable across reboots and network changes. Only the underlying IP changes, and mDNS handles the resolution transparently.

### Change 1: Add `peers.json` config

New file: `interlateral_comms/peers.json`

```json
{
  "self": "alpha",
  "peers": {
    "alpha": { "host": "Dazzas-MacBook-Air.local", "port": 3099 },
    "beta":  { "host": "<Beta-LocalHostName>.local", "port": 3099 }
  }
}
```

- Checked into each team's repo (each team sets their own `self` and fills in peer hostnames).
- The `.local` hostnames never change unless the machine is renamed.
- Adding a third team (gamma, delta, etc.) is just another entry.

### Change 2: Update `bridge-send.js` to support `--peer`

Current usage (fragile):
```bash
node bridge-send.js --host 192.168.8.216 --target codex --msg "hello"
```

Proposed usage (stable):
```bash
node bridge-send.js --peer beta --target codex --msg "hello"
```

The script reads `peers.json`, looks up the peer's `.local` hostname, and sends the request. The `--host` flag still works as a manual override for edge cases.

### Change 3: Start bridge automatically on wake-up

Add to `bootstrap-full.sh` (or `wake-up.sh`):

```bash
# Start cross-machine bridge if not already running
if ! curl -s http://localhost:3099/health > /dev/null 2>&1; then
  (cd interlateral_comms && node bridge.js &)
  echo "[Bootstrap] Cross-machine bridge started on :3099"
fi
```

This ensures the bridge is always listening on cold start, so the peer team can reach us immediately.

### Change 4: Add peer health check to wake-up protocol

After local agents are up, CC verifies cross-machine connectivity:

```bash
# Check each peer bridge
for peer in $(node -e "const p=require('./interlateral_comms/peers.json'); Object.keys(p.peers).filter(k=>k!==p.self).forEach(k=>console.log(p.peers[k].host+':'+p.peers[k].port))"); do
  curl -s --connect-timeout 3 "http://$peer/health" && echo " ← peer reachable" || echo " ← peer NOT reachable"
done
```

If a peer is unreachable, CC reports it but continues (graceful degradation — same principle as AG being optional).

---

## Cold Start Sequence (After Implementation)

```
Machine A (Alpha)                          Machine B (Beta)
─────────────────                          ─────────────────
1. Human runs wake-up.sh                   1. Human runs wake-up.sh
2. bootstrap starts bridge.js (:3099)      2. bootstrap starts bridge.js (:3099)
3. CC wakes, reads peers.json              3. CC wakes, reads peers.json
4. CC checks: curl Beta.local:3099/health  4. CC checks: curl Alpha.local:3099/health
5. mDNS resolves → current WiFi IP         5. mDNS resolves → current WiFi IP
6. ✓ Cross-machine link established        6. ✓ Cross-machine link established
7. Agents work, using --peer for sends     7. Agents work, using --peer for sends
```

No IP hunting. No manual steps. Both humans just run `wake-up.sh` and the machines find each other.

---

## Scope of Changes

| File | Change | Size |
|------|--------|------|
| `interlateral_comms/peers.json` | **New file** — peer hostname config | ~10 lines |
| `interlateral_comms/bridge-send.js` | Add `--peer` flag, read peers.json | ~15 lines added |
| `scripts/bootstrap-full.sh` | Auto-start bridge.js | ~5 lines added |
| Wake-up protocol (CLAUDE.md or wake-up.sh) | Add peer health check step | ~5 lines added |

**Total: ~35 lines of code across 4 files.** No new dependencies. No new services.

---

## Constraints and Limitations

1. **Same WiFi required.** mDNS only works on the same local network. If Alpha and Beta are on different networks (e.g., different buildings), this won't work — you'd need Tailscale or a relay.
2. **Beta hostname must be discovered once.** Someone on the Beta machine runs `scutil --get LocalHostName` and shares it. This is a one-time step per machine, not per session.
3. **Firewall.** macOS firewall must allow incoming connections on port 3099. If a machine has strict firewall rules, the bridge won't be reachable even with correct mDNS resolution.

---

## Future Enhancement: Bonjour Service Discovery (Optional)

Beyond `peers.json`, the bridge could **advertise itself as a Bonjour service** on startup:

```javascript
// bridge.js would register: _interlateral._tcp on port 3099
```

Any other bridge on the network would **auto-discover** all peers without any config file. This eliminates even the one-time hostname exchange — machines just find each other. This requires the `bonjour-service` npm package (~small dependency) and is a natural follow-on if the basic mDNS approach proves valuable.

---

## Recommendation

Implement Changes 1–4 as described. The `peers.json` + `.local` hostname approach solves the cold-start problem with minimal code, no new dependencies, and zero ongoing maintenance. It builds directly on what macOS already provides.

_______

# REVIEWS FOLLOWS:

________

# REVIEWS FROM ALPHA (macbook air) TEAM

## [CC] Review — 2026-02-11 07:45 UTC

**Verdict: APPROVE with two notes**

1. **mDNS resolution latency.** First-contact `.local` lookups can take 2–5 seconds if the peer machine just woke from sleep and hasn't announced yet. The `curl --connect-timeout 3` in Change 4 may be tight. Recommend bumping to `--connect-timeout 5` and adding a single retry with a 3-second backoff before declaring a peer unreachable.

2. **`peers.json` should be `.gitignore`'d in the template, not committed.** Each team's `peers.json` has machine-specific hostnames. If both Alpha and Beta clone the same template repo, they'd overwrite each other's config on pull. Ship a `peers.json.example` in the template and have `first-time-setup.sh` copy it to `peers.json` (like `.env.example` → `.env`). Add `interlateral_comms/peers.json` to `.gitignore`.

No blocking issues. The core approach (mDNS + static peer config) is the right call for same-network teams.

## [CX] Review — 2026-02-11 08:16 UTC

**Verdict: APPROVE with one blocker and two adjustments**

1. **Blocker: bridge auto-start lifecycle in Change 3 is brittle.** Starting with `node bridge.js &` from bootstrap can orphan processes or spawn duplicates across repeated wake-ups. Use a stable process manager pattern (PID file + stale PID cleanup at minimum) before adopting this as default.

2. **Change 2 needs explicit precedence rules.** Document that `--host` overrides `--peer` when both are provided, and fail fast if `--peer` is unknown. Without this, operators can silently send to the wrong machine during incident response.

3. **One-time Beta hostname discovery should be scripted.** Replace manual `scutil --get LocalHostName` copy/paste with a helper command that validates `.local` reachability and writes `peers.json` in one step; this removes avoidable setup drift.

## [GM] Review — 2026-02-11 07:55 UTC

**Verdict: APPROVE**

1. **Fallback for mDNS.** While `.local` is usually stable, some router configurations or guest networks block multicast/mDNS. I recommend that `peers.json` supports an optional `"fallback_ip"` field for each peer, which `bridge-send.js` can use if the `.local` resolution fails or times out.
2. **Local Port Availability.** If `bootstrap-full.sh` tries to start the bridge but the port is already taken by a stale process, the health check might pass but the bridge could be in a hung state. We should ensure the bootstrap script checks if the bridge is actually responding correctly, not just that *something* is on port 3099.
3. **Implicit vs Explicit Addressing.** When using `--peer`, it should be clear which hostname we are sending *to*. I suggest `bridge-send.js` logs the resolved hostname/IP on every send to help with debugging during these early stages of cross-machine work.



_______

# REVIEWS FROM BETA (macbook pro) TESM
