#!/bin/sh
set -eu

# The volume must already be mounted: deploy-commands imports the SQLite store.
# Keep this in the start command, never Railway's build/pre-deploy command.
if [ -n "${RAILWAY_ENVIRONMENT_ID:-}" ] && [ "${RAILWAY_VOLUME_MOUNT_PATH:-}" != "/app/data" ]; then
  echo "Railway: dodaj Volume z Mount Path /app/data przed startem bota." >&2
  exit 1
fi

node scripts/deploy-commands.js
exec node src/index.js
