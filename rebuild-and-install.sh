#!/usr/bin/env bash

# Script to bump patch version, compile, package, and reinstall the VS Code extension
# Usage: ./rebuild-and-install.sh

set -euo pipefail

echo "==> Bumping patch version in package.json"
npm version patch --no-git-tag-version

VERSION=$(node -p "require('./package.json').version")
echo "New extension version: $VERSION"

echo "==> Compiling TypeScript sources"
npm run compile

echo "==> Packaging VS Code extension"
npx --yes vsce package

VSIX_FILE=$(ls *.vsix | head -n 1)
echo "Packaged VSIX: $VSIX_FILE"

echo "==> Installing extension into VS Code"
code --install-extension "$VSIX_FILE" --force

echo "Extension $VSIX_FILE installed successfully."
