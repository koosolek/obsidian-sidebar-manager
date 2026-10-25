# Sidebar Manager

An Obsidian plugin that tidies the sidebars, especially on iPhone and iPad.

- **Views as buttons on mobile** — the left sidebar views (files, search, bookmarks, tags…) as a row of icon buttons, like on desktop, instead of the drop-down selector.
- **One menu button** — a drop-down in the tab row with the current view's own buttons (new note, new folder, sort, collapse…), your vaults, "Manage vaults…" and Settings. Desktop and mobile. With vaults and settings in the menu, the desktop sidebar footer (and the vault header on phones) goes away.
- **Search filters** — a filter for the Files view too (Obsidian has one but hides it), filters styled apart from the vault-wide search, and optionally one switch for all views: show the filter in one view and it shows in all of them.
- **Views that don't fit** — when the row runs out of room, the remaining views move behind a chevron button.
- **The same sidebar order everywhere** — Obsidian keeps the desktop and mobile layouts apart, and the mobile app can't rearrange its sidebars. Arrange the views by dragging on desktop (which sidebar, which order), or in the plugin's settings on mobile, and the other side follows.
- **Search that works with the keyboard up** — the tab row sits at the top on mobile, and the sidebar shrinks to stay above the on-screen keyboard.

Every part can be switched on or off in the plugin's settings.

## Install

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/koosolek/obsidian-sidebar-manager/releases/latest)
2. Put them in `<vault>/.obsidian/plugins/sidebar-manager/`
3. Enable **Sidebar Manager** under Settings → Community plugins

On iPhone/iPad, copy the folder into the vault from a computer (for example through iCloud Drive), then reopen Obsidian.

## Development

- `npm install`, then `npm run build` (or `npm run dev` to rebuild on change)
- `npm run deploy:ios` builds and copies the plugin into the iCloud vault "Sidebar Manager test"
- `npm run release` (or `npm run release -- minor|major|X.Y.Z`) bumps the version, tags it and pushes; GitHub Actions then publishes the release with the plugin files attached

## License

MIT

## Other plugins

Only Obsidian's own sidebar views (Files, Search, Bookmarks, Tags, All properties, Backlinks, Outgoing links, Outline) have their buttons moved into the menu. Views from other plugins are left as they are, since some use the same building blocks for their content (Advanced Tables' toolbar, for example). Their views still get the tab row and the overflow list.

## Note

The plugin works with parts of Obsidian's interface that have no public API. It was built against Obsidian 1.14; a future Obsidian update can change them. Disabling the plugin restores the original sidebar.
