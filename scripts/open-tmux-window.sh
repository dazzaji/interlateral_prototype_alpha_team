#!/bin/bash
# open-tmux-window.sh - Open a new Terminal.app window attached to a tmux session
#
# Usage: ./scripts/open-tmux-window.sh <session-name> [window-title]
#
# v1.4: Uses explicit tmux socket for Codex sandbox compatibility
# macOS natively opens .command files in a new Terminal window.

SESSION_NAME="${1:?Usage: $0 <session-name> [window-title]}"
WINDOW_TITLE="${2:-$SESSION_NAME}"

# tmux socket path - must match tmux-config.sh
TMUX_SOCKET="${TMUX_SOCKET:-/tmp/interlateral-tmux.sock}"

# Verify session exists
if ! tmux -S "$TMUX_SOCKET" has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Error: tmux session '$SESSION_NAME' does not exist"
    exit 1
fi

# Create a temporary wrapper script
WRAPPER="/tmp/attach-${SESSION_NAME}.command"

# The wrapper script that will run in the new window
cat > "$WRAPPER" <<EOF
#!/bin/bash
# Temporary wrapper to attach to tmux session
printf "\033]0;%s\007" "$WINDOW_TITLE" # Set window title
echo "Attaching to session: $SESSION_NAME"

# tmux socket path (hardcoded from parent script)
TMUX_SOCKET="$TMUX_SOCKET"

# Attempt to attach
if command -v tmux >/dev/null; then
    # -u forces UTF-8, good for emoji support
    exec tmux -S "\$TMUX_SOCKET" attach-session -t "$SESSION_NAME"
else
    echo "Error: tmux not found"
    read -p "Press enter to close"
fi
EOF

# make executable
chmod +x "$WRAPPER"

# Use 'open' to launch it.
# This leverages macOS Finder behavior to open .command files in a new Terminal window
# effectively bypassing complex AppleEvent permissions.
if open "$WRAPPER"; then
    echo "Opened Terminal window for tmux session '$SESSION_NAME'"
else
    echo "Failed to open Terminal window via 'open' command"
    exit 1
fi
