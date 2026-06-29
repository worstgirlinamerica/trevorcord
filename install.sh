#!/usr/bin/env bash
set -euo pipefail

REPO="worstgirlinamerica/trevorcord"
BRANCH="${TREVORCORD_BRANCH:-main}"
INSTALL_DIR="${TREVORCORD_HOME:-$HOME/.trevorcord}"

if ! command -v node >/dev/null 2>&1; then
  echo "TrevorCord needs Node.js for this installer."
  echo "Install Node.js from https://nodejs.org, then run this command again."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "TrevorCord needs npm for this installer."
  echo "npm is normally included with Node.js from https://nodejs.org."
  exit 1
fi

mkdir -p "$INSTALL_DIR"
TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

ARCHIVE_URL="https://github.com/$REPO/archive/refs/heads/$BRANCH.tar.gz"

echo "Downloading TrevorCord from $ARCHIVE_URL"
curl -fsSL "$ARCHIVE_URL" | tar -xz -C "$TMP_DIR" --strip-components=1

rsync -a --delete "$TMP_DIR/" "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/bin/trevorcord.js"

echo "Installing TrevorCord into Discord..."
node "$INSTALL_DIR/bin/trevorcord.js" install

cat <<EOF

Done.

Fully quit Discord and reopen it.

TrevorCord was installed at:
  $INSTALL_DIR

Useful commands:
  node "$INSTALL_DIR/bin/trevorcord.js" status
  node "$INSTALL_DIR/bin/trevorcord.js" restore
EOF
