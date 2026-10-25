// While the Files view's search filter has a query, opens the folders that hold a match, so the
// matches show without clicking folders open. Only temporarily: folders the filter opened close
// again once they hold no match (e.g. a match halfway through typing), or when the filter is cleared
// or hidden. Folders the user opens or closes meanwhile are left as the user set them.

import { debounce, WorkspaceLeaf } from "obsidian";

/** Below this many characters, or above this many matches, nothing is opened: too broad. */
const MIN_QUERY = 2;
const MAX_MATCHES = 100;

interface FileItem {
	file: { path: string; parent?: { path: string } | null };
	collapsed?: boolean;
	setCollapsed?(collapsed: boolean): void | Promise<void>;
}

interface FileExplorerView {
	containerEl: HTMLElement;
	fileItems?: Record<string, FileItem>;
	searchQuery?: { query?: string; matchFilepath?(path: string): unknown } | null;
}

export class FilesFilterExpander {
	/** Folder paths the filter opened, to close again. */
	private opened = new Set<string>();
	/** Folders the user opened or closed while filtering: left alone until the filter is cleared. */
	private touched = new Set<string>();
	private cleanups: (() => void)[] = [];
	private view: FileExplorerView | null = null;

	// Obsidian applies the query after its own short delay; look after that.
	private requestUpdate = debounce(() => this.update(), 300, true);

	/** Follows the Files view in `leaf` (or stops, for null). Safe to call repeatedly. */
	attach(leaf: WorkspaceLeaf | null) {
		const view = (leaf?.view as unknown as FileExplorerView | undefined) ?? null;
		if (view === this.view) return;
		this.detach();
		if (!view?.fileItems) return;
		this.view = view;

		const root = view.containerEl;
		const onInput = (e: Event) => {
			if ((e.target as HTMLElement).closest(".nav-header .search-input-container")) this.requestUpdate();
		};
		// Clearing (✕) and hiding the filter change the query without typing.
		const onClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (target.closest(".nav-header")) return this.requestUpdate();
			// A folder opened or closed by hand is the user's from now on.
			const title = target.closest<HTMLElement>(".nav-folder-title");
			const path = title?.dataset.path;
			if (path) {
				this.opened.delete(path);
				this.touched.add(path);
			}
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") this.requestUpdate();
		};
		root.addEventListener("input", onInput, true);
		root.addEventListener("click", onClick, true);
		root.addEventListener("keydown", onKey, true);
		this.cleanups.push(() => {
			root.removeEventListener("input", onInput, true);
			root.removeEventListener("click", onClick, true);
			root.removeEventListener("keydown", onKey, true);
		});
	}

	/** Closes what the filter opened and stops following the view. */
	detach() {
		this.requestUpdate.cancel();
		this.cleanups.forEach((c) => c());
		this.cleanups = [];
		this.closeAll();
		this.view = null;
	}

	/** Closes the folders the filter opened (e.g. before Obsidian saves which folders are open). */
	closeAll() {
		const items = this.view?.fileItems ?? {};
		for (const path of this.opened) {
			const item = items[path];
			if (item && item.collapsed === false) void item.setCollapsed?.(true);
		}
		this.opened.clear();
		this.touched.clear();
	}

	private update() {
		const view = this.view;
		if (!view?.fileItems) return;
		const items = view.fileItems;
		const query = view.searchQuery;
		const text = query?.query?.trim() ?? "";

		// Folders that hold a match: every folder above a matching file or folder.
		const wanted = new Set<string>();
		if (!text) this.touched.clear();
		if (query?.matchFilepath && text.length >= MIN_QUERY) {
			const matches = Object.values(items).filter((item) => !!query.matchFilepath!(item.file.path));
			if (matches.length <= MAX_MATCHES) {
				for (const item of matches) {
					for (let p = item.file.parent; p && p.path !== "/" && p.path !== ""; p = (items[p.path]?.file.parent ?? null)) {
						wanted.add(p.path);
					}
				}
			}
		}

		// Close what no longer holds a match, open what does (outermost first).
		for (const path of [...this.opened]) {
			if (wanted.has(path)) continue;
			const item = items[path];
			if (item && item.collapsed === false) void item.setCollapsed?.(true);
			this.opened.delete(path);
		}
		const byDepth = [...wanted].sort((a, b) => a.split("/").length - b.split("/").length);
		for (const path of byDepth) {
			const item = items[path];
			if (!item || item.collapsed !== true || this.touched.has(path)) continue;
			void item.setCollapsed?.(false);
			this.opened.add(path);
		}
	}
}
