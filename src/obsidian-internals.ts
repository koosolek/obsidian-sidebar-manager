// Shapes of the undocumented Obsidian internals this plugin relies on (checked against 1.14).
// Everything is read defensively: if a field is missing, the feature that needs it switches off.

import type { App, WorkspaceLeaf } from "obsidian";

/** The left sidebar on mobile: one drawer holding all views, with a view selector. */
export interface MobileDrawer {
	type: "mobile-drawer";
	containerEl: HTMLElement;
	/** Holds the vault name / switcher, file counts, settings and pin buttons. */
	headerEl: HTMLElement;
	/** `.workspace-drawer-tab-options`: the view selector plus its pop-up list. */
	tabsContainerEl: HTMLElement;
	/** The view list inside the selector (the views' tab headers). */
	tabsListEl: HTMLElement;
	children: WorkspaceLeaf[];
	currentTab: number;
	isPinned: boolean;
	selectTabIndex(index: number): void;
	insertChild(index: number, leaf: WorkspaceLeaf): void;
	removeChild(leaf: WorkspaceLeaf): void;
	/** Redraws the drawer: the view list and the view showing. */
	recomputeChildrenDimensions?(): void;
}

/** A tab group: on desktop each group in the left sidebar has its own tab header row. */
export interface TabGroup {
	type: "tabs";
	containerEl: HTMLElement;
	tabHeaderContainerEl: HTMLElement;
	/** Holds the tab headers. */
	tabsInnerEl: HTMLElement;
	children: WorkspaceLeaf[];
	currentTab: number;
	selectTabIndex(index: number): void;
}

/** The element a leaf shows as its tab (an icon button in sidebars). */
export function tabHeaderOf(leaf: WorkspaceLeaf): HTMLElement | null {
	return (leaf as unknown as { tabHeaderEl?: HTMLElement }).tabHeaderEl ?? null;
}

interface WorkspaceItemLike {
	type?: string;
	children?: WorkspaceItemLike[];
}

export function asMobileDrawer(item: unknown): MobileDrawer | null {
	const d = item as Partial<MobileDrawer> | null;
	return d && d.type === "mobile-drawer" && d.tabsContainerEl && d.tabsListEl && d.headerEl ? (d as MobileDrawer) : null;
}

/** All tab groups inside a split, depth first, in screen order. */
export function tabGroupsIn(item: unknown): TabGroup[] {
	const node = item as WorkspaceItemLike | null;
	if (!node) return [];
	if (node.type === "tabs" && (node as Partial<TabGroup>).tabHeaderContainerEl && (node as Partial<TabGroup>).tabsInnerEl) return [node as TabGroup];
	return (node.children ?? []).flatMap((c) => tabGroupsIn(c));
}

export function openSettings(app: App) {
	(app as unknown as { setting?: { open(): void } }).setting?.open();
}

export function openVaultChooser(app: App) {
	(app as unknown as { openVaultChooser?: () => void }).openVaultChooser?.();
}
