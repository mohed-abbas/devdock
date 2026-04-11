#!/bin/bash
# scripts/docker-cleanup.sh
# Threshold-based Docker cache cleanup per D-13
# Usage: Run via cron or manually: bash scripts/docker-cleanup.sh
# Recommended cron: 0 */6 * * * /home/murx-dev/devdock/scripts/docker-cleanup.sh >> /var/log/devdock-cleanup.log 2>&1

set -euo pipefail

THRESHOLD=${DOCKER_CLEANUP_THRESHOLD:-80}
MOUNT_POINT=${DOCKER_CLEANUP_MOUNT:-"/"}

# Get current disk usage percentage (integer)
USAGE=$(df "${MOUNT_POINT}" | awk 'NR==2 {gsub(/%/,""); print $5}')

echo "[$(date -Iseconds)] Disk usage on ${MOUNT_POINT}: ${USAGE}% (threshold: ${THRESHOLD}%)"

if [ "${USAGE}" -ge "${THRESHOLD}" ]; then
    echo "[$(date -Iseconds)] Disk usage ${USAGE}% >= ${THRESHOLD}% threshold. Running cleanup..."

    # Step 1: Remove dangling images (safe, always)
    echo "[$(date -Iseconds)] Pruning dangling images..."
    docker image prune -f 2>/dev/null || true

    # Step 2: Remove stopped containers older than 24h
    echo "[$(date -Iseconds)] Pruning stopped containers older than 24h..."
    docker container prune -f --filter "until=24h" 2>/dev/null || true

    # Step 3: Remove unused build cache older than 7 days
    echo "[$(date -Iseconds)] Pruning build cache older than 7 days..."
    docker builder prune -f --filter "until=168h" 2>/dev/null || true

    # Step 4: If still over threshold, aggressive prune (unused images)
    USAGE_AFTER=$(df "${MOUNT_POINT}" | awk 'NR==2 {gsub(/%/,""); print $5}')
    if [ "${USAGE_AFTER}" -ge "${THRESHOLD}" ]; then
        echo "[$(date -Iseconds)] Still at ${USAGE_AFTER}%. Running aggressive prune (unused images)..."
        docker system prune -f --filter "until=48h" 2>/dev/null || true
    fi

    USAGE_FINAL=$(df "${MOUNT_POINT}" | awk 'NR==2 {gsub(/%/,""); print $5}')
    echo "[$(date -Iseconds)] Cleanup complete. Disk usage: ${USAGE_FINAL}%"
else
    echo "[$(date -Iseconds)] Disk usage ${USAGE}% < ${THRESHOLD}%. No cleanup needed."
fi
