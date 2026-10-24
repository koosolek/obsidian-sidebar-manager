import { App, PluginSettingTab, Setting } from "obsidian";
import type SidebarManagerPlugin from "./main";

export interface SidebarManagerSettings {
	/** Mobile: show the left sidebar views as a row of icon buttons instead of the drop-down selector. */
	mobileTabButtons: boolean;
	/** Mobile: where the button row sits in the left sidebar. */
	mobileRowPosition: "top" | "bottom";
	/** Hide each view's action buttons and offer them from one "Actions" button in the tab row. */
	groupActions: boolean;
	/** Put a vault switcher button in the tab row. */
	vaultInRow: boolean;
	/** Put a settings button in the tab row. */
	settingsInRow: boolean;
	/** Mobile: shrink the left sidebar so the on-screen keyboard doesn't cover it. */
	keyboardFix: boolean;
}

export const DEFAULT_SETTINGS: SidebarManagerSettings = {
	mobileTabButtons: true,
	mobileRowPosition: "top",
	groupActions: true,
	vaultInRow: true,
	settingsInRow: true,
	keyboardFix: true,
};

export class SidebarManagerSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: SidebarManagerPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Tab row").setHeading();

		new Setting(containerEl)
			.setName("Group view actions")
			.setDesc("Hide the action buttons of each sidebar view (new note, sort, collapse…) and show them from one actions button in the tab row.")
			.addToggle((t) => t.setValue(this.plugin.settings.groupActions).onChange((v) => this.save({ groupActions: v })));

		new Setting(containerEl)
			.setName("Vault switcher in the tab row")
			.setDesc("Move the vault switcher into the tab row as an icon button.")
			.addToggle((t) => t.setValue(this.plugin.settings.vaultInRow).onChange((v) => this.save({ vaultInRow: v })));

		new Setting(containerEl)
			.setName("Settings button in the tab row")
			.setDesc("Move the settings button into the tab row.")
			.addToggle((t) => t.setValue(this.plugin.settings.settingsInRow).onChange((v) => this.save({ settingsInRow: v })));

		new Setting(containerEl).setName("Mobile").setHeading();

		new Setting(containerEl)
			.setName("Sidebar views as buttons")
			.setDesc("Show the left sidebar views as a row of icon buttons, like on desktop, instead of the drop-down selector.")
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
			.setDesc("While the on-screen keyboard is open (for example when searching), shrink the left sidebar so nothing in it is hidden behind the keyboard.")
			.addToggle((t) => t.setValue(this.plugin.settings.keyboardFix).onChange((v) => this.save({ keyboardFix: v })));
	}

	private async save(patch: Partial<SidebarManagerSettings>) {
		Object.assign(this.plugin.settings, patch);
		await this.plugin.saveSettings();
	}
}
