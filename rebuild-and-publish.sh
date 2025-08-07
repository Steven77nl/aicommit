#!/usr/bin/env bash

# Script to bump patch version, compile, package, and publish extension to Marketplace
# Usage: ./rebuild-and-publish.sh

set -euo pipefail

echo "==> Bumping patch version in package.json"
npm version patch --no-git-tag-version

VERSION=$(node -p "require('./package.json').version")
echo "New extension version: $VERSION"

echo "==> Compiling TypeScript sources"
npm run compile

echo "==> Publish extension to Marketplace"
npx --yes vsce publish

echo "Extension published successfully."
