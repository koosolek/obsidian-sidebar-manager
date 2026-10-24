# Sidebar Manager

An Obsidian plugin that tidies the left sidebar, especially on iPhone and iPad.

- **Views as buttons on mobile** — the left sidebar views (files, search, bookmarks, tags…) as a row of icon buttons, like on desktop, instead of the drop-down selector.
- **One actions button** — each view's own buttons (new note, new folder, sort, collapse…) move into a drop-down behind one button in the tab row. Desktop and mobile.
- **Vault switcher and settings in the tab row** — optional. With both moved, the desktop sidebar footer (and the vault header on phones) goes away.
- **Search that works with the keyboard up** — the tab row sits at the top on mobile, and the sidebar shrinks to stay above the on-screen keyboard.

Every part can be switched on or off in the plugin's settings.

## Install (manual)

1. `npm install && npm run build`
2. Copy `main.js`, `manifest.json` and `styles.css` to `<vault>/.obsidian/plugins/sidebar-manager/`
3. Enable **Sidebar Manager** under Settings → Community plugins

## Note

The plugin works with parts of Obsidian's interface that have no public API. It was built against Obsidian 1.14; a future Obsidian update can change them. Disabling the plugin restores the original sidebar.
