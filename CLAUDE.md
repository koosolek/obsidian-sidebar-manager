# Sidebar Manager (Obsidian plugin)

Obsidian community-style plugin that reworks the **left sidebar**, mainly for iOS:

- Mobile: views shown as a row of icon buttons (like desktop) instead of the drop-down selector
- One menu button (⋯) in the tab row, mobile + desktop, with sections: the active view's nav buttons (new note, sort, collapse…), the vault list, then "Manage vaults…" and Settings. The desktop sidebar footer / phone drawer header are hidden when vaults and settings are both in the menu
- Views that don't fit the row are hidden (last first) and listed behind an overflow button (chevron, not a second ⋯)
- Mobile: tab row at the top by default, and the drawer is padded so the on-screen keyboard doesn't cover it

## Stack

TypeScript, esbuild, `obsidian` API typings. No runtime dependencies.

## Commands

- `npm run build` — typecheck + production bundle to `main.js`
- `npm run dev` — watch build
- `npm run deploy:ios` — build and copy into the iCloud vault `Sidebar Manager test` (or a vault folder passed after `--`) for testing on iPhone

## Architecture

- `src/main.ts` — plugin: finds the tab rows ("hosts"), adds our buttons, hides the natives they replace, restores everything on unload
- `src/dropdown.ts` — our drop-downs (sections, items, borrowed elements); it *moves* the view's real `.nav-buttons-container` into the pop-over (keeps native handlers/states) and moves it back on close
- `src/keyboard.ts` — keyboard inset for the mobile drawer (Capacitor `keyboardWillShow` events, `--keyboard-height`, visualViewport)
- `src/obsidian-internals.ts` — typed shapes of the private Obsidian internals we rely on (mobile drawer, tab groups)
- `styles.css` — everything is scoped under `osm-*` body/element classes

## Rules

- Relies on undocumented Obsidian DOM/internals. Read them defensively; a missing field must turn a feature off, not throw
- Never copy native buttons — move/borrow the real element and always restore it
- Testing: a throwaway vault lives in `test-vault/` (gitignored). Verify in Obsidian desktop with `app.emulateMobile(true)` via the remote debugging port (9222); real-device checks are on the user
