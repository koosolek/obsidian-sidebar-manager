import { App, Platform, PluginSettingTab, SettingDefinitionItem, SettingGroupItem } from "obsidian";
import type { SidebarLayout } from "./layout";
import type SidebarManagerPlugin from "./main";

export type Sidebars = "both" | "left" | "right";

export interface SidebarManagerSettings {
	/** Hide each view's action buttons and offer them from the menu button in the tab row. */
	groupActions: boolean;
	/** Vault switcher, "Manage vaults…" and settings in the left sidebar's menu, or where Obsidian puts them. */
	vaultAndSettings: "menu" | "default";
	/** Mobile: show the sidebar views as a row of icon buttons instead of the drop-down selector. */
	mobileTabButtons: boolean;
	/** Mobile: shrink the sidebars so the on-screen keyboard doesn't cover them. */
	keyboardFix: boolean;
	/** Mobile: where the button row sits in the sidebars. */
	mobileRowPosition: "top" | "bottom";
	/** Which sidebars get all this. */
	sidebars: Sidebars;
	/** Show the Files view's search filter (Obsidian builds it but hides its button). */
	filesFilter: boolean;
	/** Toggling a view's search filter toggles it in every sidebar view, or just in that one. */
	filterToggle: "each" | "all";
	/** Mobile sidebars follow the arrangement made on the desktop. */
	syncLayout: boolean;
	/** The recorded sidebar arrangement (view types per sidebar, in order) that mobile follows. */
	layout: SidebarLayout | null;
	/** What the desktop recorded last, to tell its own changes from edits made on the phone. */
	desktopLayout: SidebarLayout | null;
}

export const DEFAULT_SETTINGS: SidebarManagerSettings = {
	groupActions: true,
	vaultAndSettings: "menu",
	mobileTabButtons: true,
	keyboardFix: true,
	mobileRowPosition: "top",
	sidebars: "both",
	filesFilter: true,
	filterToggle: "all",
	syncLayout: true,
	layout: null,
	desktopLayout: null,
};

export class SidebarManagerSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: SidebarManagerPlugin) {
		super(app, plugin);
	}

	// Rendered by Obsidian from these definitions, which also makes them findable in settings search.
	getSettingDefinitions(): SettingDefinitionItem<keyof SidebarManagerSettings>[] {
		return [
			{
				type: "group",
				heading: "Sidebar menu",
				items: [
					{
						name: "View actions",
						desc: "Hide the action buttons of each sidebar view (new note, sort, collapse…) and show them in the menu (⋯) in the view's tab row.",
						control: { type: "toggle", key: "groupActions", defaultValue: DEFAULT_SETTINGS.groupActions },
					},
					{
						name: "Vault switcher and settings",
						desc: "In the left sidebar's menu (this hides the sidebar footer on desktop and the vault header on phones), or where Obsidian puts them.",
						control: {
							type: "dropdown",
							key: "vaultAndSettings",
							options: { menu: "In the menu", default: "Obsidian default" },
							defaultValue: DEFAULT_SETTINGS.vaultAndSettings,
						},
					},
				],
			},
			{
				type: "group",
				heading: "Search filters",
				items: [
					{
						name: "Filter in Files",
						desc: "Add a search filter to the Files view, like Bookmarks and Tags have. (Obsidian already has it, but hides its button.)",
						control: { type: "toggle", key: "filesFilter", defaultValue: DEFAULT_SETTINGS.filesFilter },
					},
					{
						name: "Show and hide filters",
						desc: "Showing or hiding the search filter in one sidebar view does the same in all of them, or only in that view.",
						control: {
							type: "dropdown",
							key: "filterToggle",
							options: { all: "In all views together", each: "In each view separately" },
							defaultValue: DEFAULT_SETTINGS.filterToggle,
						},
					},
				],
			},
			{
				type: "group",
				heading: "Mobile",
				items: [
					{
						name: "Sidebar views as buttons",
						desc: "Show the sidebar views as a row of icon buttons, like on desktop, instead of the drop-down selector.",
						control: { type: "toggle", key: "mobileTabButtons", defaultValue: DEFAULT_SETTINGS.mobileTabButtons },
					},
					{
						name: "Keep the sidebar above the keyboard",
						desc: "While the on-screen keyboard is open (for example when searching), shrink the sidebar so nothing in it is hidden behind the keyboard.",
						control: { type: "toggle", key: "keyboardFix", defaultValue: DEFAULT_SETTINGS.keyboardFix },
					},
					{
						name: "Tab row position",
						desc: "Where the view buttons and the menu sit in the sidebar. With the sidebar kept above the keyboard, both positions stay reachable while typing.",
						control: {
							type: "dropdown",
							key: "mobileRowPosition",
							options: { top: "Top", bottom: "Bottom" },
							defaultValue: DEFAULT_SETTINGS.mobileRowPosition,
						},
					},
				],
			},
			{
				type: "group",
				heading: "Sidebar layout",
				items: [
					{
						name: "Mobile follows desktop",
						desc: "Which views sit in which sidebar, and in what order. Arrange them by dragging on desktop, and phones and tablets follow. You can also rearrange here on mobile; the next rearrangement on desktop replaces it.",
						control: { type: "toggle", key: "syncLayout", defaultValue: DEFAULT_SETTINGS.syncLayout },
					},
				],
			},
			...this.layoutLists(),
			{
				type: "group",
				heading: "Sidebars",
				items: [
					{
						name: "Apply to",
						desc: "The vault switcher and settings only ever go in the left sidebar's menu.",
						control: {
							type: "dropdown",
							key: "sidebars",
							options: { both: "Both sidebars", left: "Left sidebar", right: "Right sidebar" },
							defaultValue: DEFAULT_SETTINGS.sidebars,
						},
					},
				],
			},
		];
	}

	/** Mobile: the arrangement as two reorderable lists, with a button to move a view across. */
	/**
	 * Mobile: the arrangement as one reorderable list, the left sidebar's views first, then a
	 * "Right sidebar" divider, then the right sidebar's. Dragging a view past the divider moves it
	 * to the other sidebar.
	 */
	private layoutLists(): SettingDefinitionItem<keyof SidebarManagerSettings>[] {
		const layout = this.plugin.layoutForEditing();
		const DIVIDER = null;
		const entries: (string | null)[] = [...layout.left, DIVIDER, ...layout.right];
		const items: SettingGroupItem<keyof SidebarManagerSettings>[] = entries.map((type) =>
			type === DIVIDER
				? {
						name: "Right sidebar",
						desc: "Views below this line are in the right sidebar.",
						render: (setting) => {
							setting.settingEl.addClass("osm-layout-divider");
						},
					}
				: { name: this.viewName(type), render: () => {} }
		);
		return [
			{
				type: "list",
				heading: "Left sidebar",
				visible: () => Platform.isMobile && this.plugin.settings.syncLayout,
				onReorder: (from: number, to: number) => {
					const next = [...entries];
					const [moved] = next.splice(from, 1);
					next.splice(to, 0, moved);
					const split = next.indexOf(DIVIDER);
					const left = next.slice(0, split).filter((t): t is string => t !== DIVIDER);
					const right = next.slice(split + 1).filter((t): t is string => t !== DIVIDER);
					void this.plugin.setLayout({ ...layout, left, right }).then(() => this.update());
				},
				items,
			},
		];
	}

	/** A view type's name as Obsidian shows it, if a view of that type is open. */
	private viewName(type: string): string {
		const leaf = this.app.workspace.getLeavesOfType(type)[0];
		const name = leaf?.getDisplayText();
		return name && name !== type ? name : type.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as keyof SidebarManagerSettings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		Object.assign(this.plugin.settings, { [key]: value });
		await this.plugin.saveSettings();
		// Show or hide what depends on it (the layout lists).
		this.refreshDomState();
	}
}
