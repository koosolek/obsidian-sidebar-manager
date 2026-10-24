# Contributing

Thanks for helping out. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug

Open an [issue](https://github.com/koosolek/obsidian-sidebar-manager/issues) with:

- Obsidian version, and whether it's desktop, iPhone, iPad or Android
- what you did, what you expected, and what happened instead
- a screenshot if it's about how something looks

## Making a change

1. Fork the repository and create a branch.
2. `npm install`, then `npm run dev` to rebuild on every change.
3. Link or copy `main.js`, `manifest.json` and `styles.css` into `<a test vault>/.obsidian/plugins/sidebar-manager/` and reload the plugin.
4. Check the change on desktop and in Obsidian's mobile layout (in the developer console: `app.emulateMobile(true)`, and `app.emulateMobile(false)` to go back).
5. Run `npm run build` (it type-checks), then open a pull request describing what changed and why.

## Things to keep in mind

- The plugin works with parts of Obsidian's interface that have no public API. Read them defensively: if something is missing, the feature that needs it should switch off rather than throw.
- Native buttons are moved into our menus, never copied, and always put back. Keep it that way.
- Styling lives in `styles.css`, scoped under `osm-*` classes, using Obsidian's CSS variables.
- Releases are cut by the maintainer with `npm run release`.
