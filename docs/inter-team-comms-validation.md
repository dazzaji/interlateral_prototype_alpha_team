# Inter-Team Comms Validation

## Status

Validated and passing as of **2026-02-12**.

## Scope

Two-machine Alpha/Beta cross-team bridge validation for:

1. Auth guardrail (`BRIDGE_TOKEN` required on `/inject`)
2. Identity stamps on relayed messages
3. Bidirectional round-trip delivery

## Latest Test Run

- **Timestamp (UTC):** `2026-02-12T23:41:39Z`
- **Alpha bridge health:** PASS
- **Beta bridge health:** PASS
- **Auth guardrail:** PASS (`401` without token, `200` with token)
- **Identity stamps:** PASS (`[ID team=... sender=... host=... sid=...]`)
- **Round-trip Alpha <-> Beta:** PASS
- **Sync confirmation from Beta:**  
  `SYNC-ACK auth_guardrail=PASS identity_stamps=PASS round_trip=PASS plan=IN_SYNC`

## Operational Notes

- Cross-team mode is opt-in via `./scripts/wake-up.sh --cross-team`.
- Set `INTERLATERAL_TEAM_ID` uniquely per machine/team.
- Set the same `BRIDGE_TOKEN` on all peer machines.
- Primary runbook: `interlateral_dna/LIVE_COMMS.md`.
