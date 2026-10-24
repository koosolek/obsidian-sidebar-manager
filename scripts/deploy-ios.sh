#!/bin/sh
# Builds the plugin and copies it into an iCloud vault, so Obsidian on iPhone/iPad picks it up.
# iCloud doesn't sync symlinks, hence real copies. Usage: npm run deploy:ios [-- "<vault folder>"]
set -e
ICLOUD="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents"
VAULT="${1:-$ICLOUD/Sidebar Manager test}"
DEST="$VAULT/.obsidian/plugins/sidebar-manager"

cd "$(dirname "$0")/.."
npm run build --silent
mkdir -p "$DEST"
cp main.js manifest.json styles.css "$DEST/"

# A fresh vault: switch the plugin on and give it a few notes to look at.
if [ ! -f "$VAULT/.obsidian/community-plugins.json" ]; then
	echo '["sidebar-manager"]' > "$VAULT/.obsidian/community-plugins.json"
	mkdir -p "$VAULT/Projects" "$VAULT/Daily"
	for n in "Welcome" "Projects/Plugin ideas" "Projects/Sidebar" "Daily/Today"; do
		printf '# %s\n\nSome text about sidebars and search. #test\n' "$(basename "$n")" > "$VAULT/$n.md"
	done
fi
echo "Copied to $DEST"
