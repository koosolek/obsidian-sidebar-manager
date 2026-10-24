import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
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
}

export const DEFAULT_SETTINGS: SidebarManagerSettings = {
	groupActions: true,
	vaultAndSettings: "menu",
	mobileTabButtons: true,
	keyboardFix: true,
	mobileRowPosition: "top",
	sidebars: "both",
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

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as keyof SidebarManagerSettings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		Object.assign(this.plugin.settings, { [key]: value });
		await this.plugin.saveSettings();
	}
}
