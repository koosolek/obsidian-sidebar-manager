#!/usr/bin/env bash
# Cut a new Sidebar Manager release.
#
# Usage:
#   scripts/cut-release.sh               → bump the patch (0.1.0 → 0.1.1)
#   scripts/cut-release.sh minor         → bump the minor (0.1.3 → 0.2.0)
#   scripts/cut-release.sh major         → bump the major (0.9.4 → 1.0.0)
#   scripts/cut-release.sh 1.2.3         → explicit version
#   scripts/cut-release.sh current       → release the version already in manifest.json
#
# What it does:
#   1. Sets the version in manifest.json and package.json, and adds it to versions.json
#      (with the manifest's minAppVersion).
#   2. Commits the change as "Release X.Y.Z" (skipped for "current").
#   3. Tags the commit as X.Y.Z — Obsidian wants the bare version, no "v".
#   4. Pushes the commit and the tag to origin.
#
# The tag push triggers .github/workflows/release.yml, which builds the plugin and publishes a
# GitHub Release with main.js, manifest.json and styles.css attached.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
	echo "error: working tree not clean — commit or stash first" >&2
	git status --short
	exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
	echo "error: cut from main, currently on '$BRANCH'" >&2
	exit 1
fi

CURRENT=$(node -p "require('./manifest.json').version")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "${1:-patch}" in
	current) NEXT="$CURRENT" ;;
	patch) NEXT="$MAJOR.$MINOR.$((PATCH + 1))" ;;
	minor) NEXT="$MAJOR.$((MINOR + 1)).0" ;;
	major) NEXT="$((MAJOR + 1)).0.0" ;;
	[0-9]*.[0-9]*.[0-9]*) NEXT="$1" ;;
	*)
		echo "error: unrecognised argument '$1' — use patch|minor|major|current|X.Y.Z" >&2
		exit 1
		;;
esac

if git rev-parse "$NEXT" >/dev/null 2>&1; then
	echo "error: tag $NEXT already exists" >&2
	exit 1
fi

# Make sure it builds before tagging anything.
npm run build --silent

if [ "$NEXT" != "$CURRENT" ]; then
	echo "Cutting release: $CURRENT → $NEXT"
	NEXT="$NEXT" node -e '
		const fs = require("fs");
		const write = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, "\t") + "\n");
		const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
		manifest.version = process.env.NEXT;
		write("manifest.json", manifest);
		const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
		pkg.version = process.env.NEXT;
		write("package.json", pkg);
		const versions = JSON.parse(fs.readFileSync("versions.json", "utf8"));
		versions[process.env.NEXT] = manifest.minAppVersion;
		write("versions.json", versions);
	'
	npm install --package-lock-only --silent
	git add manifest.json package.json package-lock.json versions.json
	git commit -m "Release $NEXT"
else
	echo "Releasing the current version: $NEXT"
fi

git tag "$NEXT"
git push origin main
git push origin "$NEXT"

echo
echo "Pushed $NEXT. The release appears at:"
echo "  $(gh repo view --json url -q .url 2>/dev/null || echo '<repo>')/releases/tag/$NEXT"
