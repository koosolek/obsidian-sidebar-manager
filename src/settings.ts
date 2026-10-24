import { App, PluginSettingTab, Setting } from "obsidian";
import type SidebarManagerPlugin from "./main";

export interface SidebarManagerSettings {
	/** Mobile: show the sidebar views as a row of icon buttons instead of the drop-down selector. */
	mobileTabButtons: boolean;
	/** Mobile: where the button row sits in the sidebars. */
	mobileRowPosition: "top" | "bottom";
	/** Hide each view's action buttons and offer them from the menu button in the tab row. */
	groupActions: boolean;
	/** Offer the vault switcher (and "Manage vaults…") in the menu instead of the sidebar footer. */
	vaultInMenu: boolean;
	/** Offer the settings button in the menu instead of the sidebar footer. */
	settingsInMenu: boolean;
	/** Mobile: shrink the sidebars so the on-screen keyboard doesn't cover them. */
	keyboardFix: boolean;
	/** Give the right sidebar the same tab row, menu and overflow as the left one. */
	rightSidebar: boolean;
}

export const DEFAULT_SETTINGS: SidebarManagerSettings = {
	mobileTabButtons: true,
	mobileRowPosition: "top",
	groupActions: true,
	vaultInMenu: true,
	settingsInMenu: true,
	keyboardFix: true,
	rightSidebar: true,
};

export class SidebarManagerSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: SidebarManagerPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Right sidebar too")
			.setDesc("Give the right sidebar the same tab row, menu (view actions only) and overflow list as the left one.")
			.addToggle((t) => t.setValue(this.plugin.settings.rightSidebar).onChange((v) => this.save({ rightSidebar: v })));

		new Setting(containerEl)
			.setName("Sidebar menu")
			.setDesc("One button in a sidebar's tab row opens a menu. Choose what goes in it.")
			.setHeading();

		new Setting(containerEl)
			.setName("View actions")
			.setDesc("Hide the action buttons of each sidebar view (new note, sort, collapse…) and show them in the menu.")
			.addToggle((t) => t.setValue(this.plugin.settings.groupActions).onChange((v) => this.save({ groupActions: v })));

		new Setting(containerEl)
			.setName("Vaults")
			.setDesc("Switch vaults and manage vaults from the menu instead of the vault switcher.")
			.addToggle((t) => t.setValue(this.plugin.settings.vaultInMenu).onChange((v) => this.save({ vaultInMenu: v })));

		new Setting(containerEl)
			.setName("Settings")
			.setDesc("Open settings from the menu instead of the settings button. With vaults and settings both in the menu, the desktop sidebar footer (and the vault header on phones) is hidden.")
			.addToggle((t) => t.setValue(this.plugin.settings.settingsInMenu).onChange((v) => this.save({ settingsInMenu: v })));

		new Setting(containerEl).setName("Mobile").setHeading();

		new Setting(containerEl)
			.setName("Sidebar views as buttons")
			.setDesc("Show the sidebar views as a row of icon buttons, like on desktop, instead of the drop-down selector.")
			.addToggle((t) => t.setValue(this.plugin.settings.mobileTabButtons).onChange((v) => this.save({ mobileTabButtons: v })));

		new Setting(containerEl)
			.setName("Tab row position")
			.setDesc("On phones Obsidian puts the view selector at the bottom, where the keyboard covers it. At the top it stays reachable while typing.")
			.addDropdown((d) =>
				d
					.addOption("top", "Top")
					.addOption("bottom", "Bottom")
					.setValue(this.plugin.settings.mobileRowPosition)
					.onChange((v) => this.save({ mobileRowPosition: v as "top" | "bottom" }))
			);

		new Setting(containerEl)
			.setName("Keep the sidebar above the keyboard")
			.setDesc("While the on-screen keyboard is open (for example when searching), shrink the sidebars so nothing in them is hidden behind the keyboard.")
			.addToggle((t) => t.setValue(this.plugin.settings.keyboardFix).onChange((v) => this.save({ keyboardFix: v })));
	}

	private async save(patch: Partial<SidebarManagerSettings>) {
		Object.assign(this.plugin.settings, patch);
		await this.plugin.saveSettings();
	}
}
