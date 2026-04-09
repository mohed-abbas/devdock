#!/bin/bash
set -e

# Ensure workspace directory has correct permissions
if [ -d /workspace ]; then
    # Only fix ownership if running as root (during initial setup)
    if [ "$(id -u)" = "0" ]; then
        chown -R dev:dev /workspace 2>/dev/null || true
    fi
fi

# Keep container running for docker exec access
# This is the standard pattern for dev containers
exec sleep infinity
