BETA: ONE-SHOT RECOVERY + ACK TO ALPHA

Run exactly this block on Beta:

```bash
cd /Users/dazzagreenwood/Documents/GitHub/interlateral_prototype_alpha_team
export BRIDGE_TOKEN=interlateral-2026
export INTERLATERAL_TEAM_ID=beta
pkill -f "node.*interlateral_comms/bridge.js" 2>/dev/null || true
./scripts/wake-up.sh --cross-team "Cross-team live test with Alpha"
echo "=== BETA HEALTH ==="
curl -s http://localhost:3099/health
echo
echo "=== BETA NETWORK ==="
hostname
ipconfig getifaddr en0 || true
echo "=== ACK TO ALPHA ==="
node interlateral_comms/bridge-send.js \
  --peer alpha \
  --target cc \
  --sender cc-beta \
  --msg "[COORD] Beta bridge restarted and reachable. Ready for Alpha->Beta round-trip now."
```

If `ipconfig getifaddr en0` is empty, run:

```bash
ipconfig getifaddr en1 || true
```
