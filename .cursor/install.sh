#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for WRLD.domains.
#
# The repo's `npm test` runs `node --test "src/**/*.test.ts"`, which needs a
# Node that strips TypeScript with no flag (Node >= 22.18; CI pins Node 24).
# The sandbox daemon injects its own node (v22.14) at the front of PATH, so we
# install Node 24 via nvm and shim node/npm/npx into the one PATH entry that
# precedes the daemon (/usr/local/cargo/bin). That makes `node` == v24 in every
# shell, matching CI, without editing repo code.
set -euo pipefail

cd "$(dirname "$0")/.."

NODE_MAJOR=24

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "nvm not found at $NVM_DIR; cannot provision Node ${NODE_MAJOR}." >&2
  exit 1
fi
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"

nvm install "$NODE_MAJOR" >/dev/null
nvm alias default "$NODE_MAJOR" >/dev/null
NODE24_BIN="$(dirname "$(nvm which "$NODE_MAJOR")")"

# Prefer a PATH dir that comes before the daemon's /exec-daemon node. Fall back
# to ~/.local/bin if /usr/local/cargo/bin is missing or not writable.
SHIM_DIR="/usr/local/cargo/bin"
if [ ! -d "$SHIM_DIR" ] || [ ! -w "$SHIM_DIR" ]; then
  SHIM_DIR="$HOME/.local/bin"
  mkdir -p "$SHIM_DIR"
fi
for bin in node npm npx; do
  ln -sf "$NODE24_BIN/$bin" "$SHIM_DIR/$bin"
done

echo "Using $("$SHIM_DIR/node" -v) via $SHIM_DIR"

npm ci
