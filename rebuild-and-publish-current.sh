#!/usr/bin/env bash

# Script to bump patch version, compile, package, and publish extension to Marketplace
# Usage: ./rebuild-and-publish.sh

set -euo pipefail

echo "removing previous .vsix file (if any)"
# find first .vsix file and remove it safely
VSIX_TO_REMOVE=$(ls *.vsix 2>/dev/null | head -n 1 || true)
if [ -n "$VSIX_TO_REMOVE" ]; then
  echo "Removing $VSIX_TO_REMOVE"
  rm -f -- "$VSIX_TO_REMOVE"
else
  echo "No .vsix files found"
fi

VERSION=$(node -p "require('./package.json').version")
echo "Extension version: $VERSION"

echo "==> Compiling TypeScript sources"
npm run compile

echo "==> Publish extension to Marketplace"
npx --yes vsce publish

echo "Extension published successfully."
