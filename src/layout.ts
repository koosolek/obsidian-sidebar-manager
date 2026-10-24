// Which views sit in which sidebar, and in what order. Obsidian keeps the desktop and the mobile
// layout in separate files (workspace.json, workspace-mobile.json), so arranging the sidebars on the
// desktop never reaches the phone, and the phone can't rearrange its sidebars at all. The plugin
// records the desktop arrangement in its own settings (which sync with the vault) and applies it
// on mobile.

import type { App, WorkspaceLeaf } from "obsidian";
import { asMobileDrawer, MobileDrawer, tabGroupsIn } from "./obsidian-internals";

/** View types per sidebar, in order. */
export interface SidebarLayout {
	left: string[];
	right: string[];
	/**
	 * Sidebar view types the desktop has but keeps closed (e.g. a plugin's view the user closed).
	 * Mobile closes them too. Views the desktop doesn't know at all (a mobile-only plugin) stay.
	 */
	closed?: string[];
}

export function isSidebarLayout(value: unknown): value is SidebarLayout {
	const v = value as Partial<SidebarLayout> | null;
	const isList = (x: unknown) => Array.isArray(x) && x.every((t) => typeof t === "string");
	return !!v && isList(v.left) && isList(v.right) && (v.closed === undefined || isList(v.closed));
}

export function sameLayout(a: SidebarLayout | null, b: SidebarLayout | null): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/** A leaf's view type, also for views that haven't loaded yet. */
export function viewTypeOf(leaf: WorkspaceLeaf): string {
	return leaf.getViewState().type;
}

function leavesIn(split: unknown): WorkspaceLeaf[] {
	const drawer = asMobileDrawer(split);
	if (drawer) return drawer.children;
	return tabGroupsIn(split).flatMap((g) => g.children);
}

/** Views that open files or fill the main area: never treated as sidebar views. */
const MAIN_AREA_TYPES = new Set(["empty", "graph", "release-notes", "webviewer"]);

interface ViewRegistry {
	viewByType?: Record<string, unknown>;
	typeByExtension?: Record<string, string>;
}

/** The current arrangement of this device's sidebars, and the sidebar views it keeps closed. */
export function readLayout(app: App): SidebarLayout {
	const types = (split: unknown) => leavesIn(split).map(viewTypeOf).filter((t) => t && t !== "empty");
	const left = types(app.workspace.leftSplit);
	const right = types(app.workspace.rightSplit);
	const registry = (app as unknown as { viewRegistry?: ViewRegistry }).viewRegistry;
	const fileViews = new Set(Object.values(registry?.typeByExtension ?? {}));
	const open = new Set([...left, ...right]);
	const closed = Object.keys(registry?.viewByType ?? {}).filter(
		(t) => !open.has(t) && !fileViews.has(t) && !MAIN_AREA_TYPES.has(t)
	);
	return { left, right, closed };
}

/**
 * Mobile: closes the views the desktop keeps closed, then moves and reorders the sidebar views to
 * match `layout`. Views it doesn't mention stay in their sidebar, after the ones it does; views it
 * mentions that this device doesn't have are skipped. Views are moved, not recreated, so they keep
 * their state. Returns whether anything changed.
 */
export function applyLayout(app: App, layout: SidebarLayout): boolean {
	const left = asMobileDrawer(app.workspace.leftSplit);
	const right = asMobileDrawer(app.workspace.rightSplit);
	if (!left || !right) return false;

	// Close what the desktop keeps closed (never a sidebar's last view).
	let changed = false;
	const closed = new Set(layout.closed ?? []);
	for (const drawer of [left, right]) {
		for (const leaf of [...drawer.children]) {
			if (closed.has(viewTypeOf(leaf)) && drawer.children.length > 1) {
				leaf.detach();
				changed = true;
			}
		}
	}

	const available = [...left.children, ...right.children];
	const claimed = new Set<WorkspaceLeaf>();
	const pick = (types: string[]) =>
		types.flatMap((type) => {
			const leaf = available.find((l) => !claimed.has(l) && viewTypeOf(l) === type);
			if (!leaf) return [];
			claimed.add(leaf);
			return [leaf];
		});
	const wantedLeft = pick(layout.left);
	const wantedRight = pick(layout.right);
	const targets: [MobileDrawer, WorkspaceLeaf[]][] = [
		[left, [...wantedLeft, ...left.children.filter((l) => !claimed.has(l))]],
		[right, [...wantedRight, ...right.children.filter((l) => !claimed.has(l))]],
	];
	// A sidebar is never emptied: Obsidian doesn't expect an empty drawer.
	if (targets.some(([, leaves]) => leaves.length === 0)) return changed;

	let moved = changed;
	for (const [drawer, leaves] of targets) {
		leaves.forEach((leaf, index) => {
			if (drawer.children[index] === leaf) return;
			const from = (leaf as unknown as { parent?: MobileDrawer | null }).parent;
			const current = drawer.children[drawer.currentTab];
			from?.removeChild(leaf);
			drawer.insertChild(index, leaf);
			// Keep the view that was showing (inserting shifts the indices).
			if (current && drawer.children.includes(current)) drawer.currentTab = drawer.children.indexOf(current);
			moved = true;
		});
	}
	if (moved) {
		for (const [drawer] of targets) drawer.recomputeChildrenDimensions?.();
		app.workspace.requestSaveLayout();
	}
	return moved;
}
