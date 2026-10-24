# obsidian-sidebar-manager — Notes

## To-Do

- Verify on a real iPhone: tab buttons, actions drop-down, vault picker, settings, search with the keyboard up
- Plugin compatibility (Advanced Tables): check the committed-but-unreleased fix (e8c6188 — only Obsidian's own views get their buttons moved into the menu) in Obsidian, then release 0.1.4
- Then decide: keep the built-in-views-only list, add a setting to opt other plugins' views in, and/or add a README note that other plugins using the same header markup are left alone

## Ideas & Thoughts

- Help button disappears with the desktop sidebar footer — could live in the actions drop-down or the row

## Notes

- Built against Obsidian 1.14 internals (mobile drawer, tab groups, vault profile footer); see `src/obsidian-internals.ts`
