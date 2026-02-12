Graceful shutdown (if anything is running)

  # Kill any existing sessions/bridges
  tmux -S /tmp/interlateral-tmux.sock kill-server 2>/dev/null
  pkill -f "node.*bridge.js" 2>/dev/null