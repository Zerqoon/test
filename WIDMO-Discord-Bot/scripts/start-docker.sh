#!/bin/sh
set -eu

# Keep commands and SQLite on the same persistent Railway volume.
if [ -n "${RAILWAY_ENVIRONMENT_ID:-}" ] && [ "${RAILWAY_VOLUME_MOUNT_PATH:-}" != "/app/data" ]; then
  echo "Railway: dodaj Volume z Mount Path /app/data przed startem bota." >&2
  exit 1
fi

if [ "$(id -u)" -eq 0 ] && command -v gosu >/dev/null 2>&1; then
  mkdir -p /app/data
  # Railway volumes can be mounted root-owned. Fix ownership once, then run Node as unprivileged user.
  chown -R node:node /app/data
  exec gosu node sh -eu -c 'node scripts/deploy-commands.js && exec node src/index.js'
fi

node scripts/deploy-commands.js
exec node src/index.js
