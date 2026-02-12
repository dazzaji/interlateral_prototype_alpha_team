Beta Team: Start Cross-Team Bridge and ACK Alpha

1) Go to repo
```bash
cd /Users/dazzagreenwood/Documents/GitHub/interlateral_prototype_alpha_team
```

2) Set shared token (must match Alpha)
```bash
export BRIDGE_TOKEN=interlateral-2026
```

3) Start cross-team mode
```bash
./scripts/wake-up.sh --cross-team "Cross-team live test with Alpha"
```

4) Verify your bridge is up
```bash
curl -s http://localhost:3099/health
```
Expected: JSON including `"ok":true` and `"service":"interlateral-bridge"`.

5) Send ACK to Alpha (from Beta machine)
```bash
node interlateral_comms/bridge-send.js \
  --peer alpha \
  --target cc \
  --sender cc-beta \
  --msg "[COORD] Beta bridge is up. Please send test packet."
```

Optional cleanup (if needed first):
```bash
tmux -S /tmp/interlateral-tmux.sock kill-server 2>/dev/null
pkill -f "node.*bridge.js" 2>/dev/null
```
