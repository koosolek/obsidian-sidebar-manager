import { App, PluginSettingTab, Setting } from "obsidian";
import type SidebarManagerPlugin from "./main";

export type Sidebars = "both" | "left" | "right";

export interface SidebarManagerSettings {
	/** Hide each view's action buttons and offer them from the menu button in the tab row. */
	groupActions: boolean;
	/** Vault switcher, "Manage vaults…" and settings in the left sidebar's menu, instead of where Obsidian puts them. */
	vaultAndSettingsInMenu: boolean;
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
	vaultAndSettingsInMenu: true,
	mobileTabButtons: true,
	keyboardFix: true,
	mobileRowPosition: "top",
	sidebars: "both",
};

export class SidebarManagerSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: SidebarManagerPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		const s = this.plugin.settings;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Sidebar menu")
			.setDesc("One button (⋯) in a sidebar's tab row opens a menu. Choose what goes in it.")
			.setHeading();

		new Setting(containerEl)
			.setName("View actions")
			.setDesc("Hide the action buttons of each sidebar view (new note, sort, collapse…) and show them in the menu.")
			.addToggle((t) => t.setValue(s.groupActions).onChange((v) => this.save({ groupActions: v })));

		new Setting(containerEl)
			.setName("Vault switcher and settings")
			.setDesc("In the left sidebar's menu (this hides the sidebar footer on desktop and the vault header on phones), or where Obsidian puts them.")
			.addDropdown((d) =>
				d
					.addOption("menu", "In the menu")
					.addOption("default", "Obsidian default")
					.setValue(s.vaultAndSettingsInMenu ? "menu" : "default")
					.onChange((v) => this.save({ vaultAndSettingsInMenu: v === "menu" }))
			);

		new Setting(containerEl).setName("Mobile").setHeading();

		new Setting(containerEl)
			.setName("Sidebar views as buttons")
			.setDesc("Show the sidebar views as a row of icon buttons, like on desktop, instead of the drop-down selector.")
			.addToggle((t) => t.setValue(s.mobileTabButtons).onChange((v) => this.save({ mobileTabButtons: v })));

		new Setting(containerEl)
			.setName("Keep the sidebar above the keyboard")
			.setDesc("While the on-screen keyboard is open (for example when searching), shrink the sidebar so nothing in it is hidden behind the keyboard.")
			.addToggle((t) => t.setValue(s.keyboardFix).onChange((v) => this.save({ keyboardFix: v })));

		new Setting(containerEl)
			.setName("Tab row position")
			.setDesc("Where the view buttons and the menu sit in the sidebar. With the sidebar kept above the keyboard, both positions stay reachable while typing.")
			.addDropdown((d) =>
				d
					.addOption("top", "Top")
					.addOption("bottom", "Bottom")
					.setValue(s.mobileRowPosition)
					.onChange((v) => this.save({ mobileRowPosition: v as "top" | "bottom" }))
			);

		new Setting(containerEl).setName("Sidebars").setHeading();

		new Setting(containerEl)
			.setName("Apply to")
			.setDesc("The vault switcher and settings only ever go in the left sidebar's menu.")
			.addDropdown((d) =>
				d
					.addOption("both", "Both sidebars")
					.addOption("left", "Left sidebar")
					.addOption("right", "Right sidebar")
					.setValue(s.sidebars)
					.onChange((v) => this.save({ sidebars: v as Sidebars }))
			);
	}

	private async save(patch: Partial<SidebarManagerSettings>) {
		Object.assign(this.plugin.settings, patch);
		await this.plugin.saveSettings();
	}
}
