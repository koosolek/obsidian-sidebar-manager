import { debounce, Menu, Notice, Platform, Plugin, setIcon, setTooltip, WorkspaceLeaf } from "obsidian";
import { ActionsPopover, navButtonsOf } from "./actions-popover";
import { KeyboardInset } from "./keyboard";
import { asMobileDrawer, desktopVaults, MobileDrawer, openSettings, openVaultChooser, tabGroupsIn } from "./obsidian-internals";
import { DEFAULT_SETTINGS, SidebarManagerSettings, SidebarManagerSettingTab } from "./settings";

/** A row of view tabs in the left sidebar that gets our buttons. */
interface Host {
	rowEl: HTMLElement;
	/** The first row gets the vault and settings buttons; every row gets an actions button. */
	primary: boolean;
	activeLeaf(): WorkspaceLeaf | undefined;
	place(controlsEl: HTMLElement): void;
}

interface Controls {
	el: HTMLElement;
	primary: boolean;
	actionsEl: HTMLElement | null;
}

const BODY_CLASSES = ["osm-mobile-tabs", "osm-row-top", "osm-row-bottom", "osm-group-actions", "osm-vault-in-row"];

export default class SidebarManagerPlugin extends Plugin {
	settings: SidebarManagerSettings = { ...DEFAULT_SETTINGS };

	private controls = new Map<HTMLElement, Controls>();
	private popover = new ActionsPopover();
	private keyboard: KeyboardInset | null = null;
	/** Native elements we hid because ours replace them. */
	private hidden = new Set<HTMLElement>();
	/** Mobile: the vault picker's `<select>`, lent to our vault button. */
	private borrowedSelect: { el: HTMLElement; parent: Node; next: Node | null } | null = null;

	private requestRefresh = debounce(() => this.refresh(), 50, true);

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SidebarManagerSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.apply();
			this.registerEvent(this.app.workspace.on("layout-change", this.requestRefresh));
			this.registerEvent(this.app.workspace.on("active-leaf-change", this.requestRefresh));
			// Sidebar views load lazily; catch the nav buttons they add after the first pass.
			this.registerInterval(window.setInterval(() => this.refresh(), 2000));
		});
	}

	onunload() {
		this.teardown();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		if (this.app.workspace.layoutReady) {
			this.teardown();
			this.apply();
		}
	}

	// --- applying and removing ---------------------------------------------------------------

	private apply() {
		const s = this.settings;
		const body = document.body;
		if (Platform.isMobile) {
			body.toggleClass("osm-mobile-tabs", s.mobileTabButtons);
			body.addClass(s.mobileRowPosition === "top" ? "osm-row-top" : "osm-row-bottom");
		}
		body.toggleClass("osm-group-actions", s.groupActions);
		body.toggleClass("osm-vault-in-row", s.vaultInRow);

		if (Platform.isMobile && s.keyboardFix) {
			this.keyboard = new KeyboardInset(() => this.mobileDrawer()?.containerEl ?? null);
			this.keyboard.start();
		}
		this.refresh();
	}

	private teardown() {
		this.popover.close();
		this.keyboard?.stop();
		this.keyboard = null;
		this.restoreSelect();
		for (const c of this.controls.values()) c.el.remove();
		this.controls.clear();
		document.querySelectorAll(".osm-row").forEach((el) => el.removeClass("osm-row"));
		for (const el of this.hidden) el.removeClass("osm-hidden");
		this.hidden.clear();
		document.body.removeClass(...BODY_CLASSES);
	}

	/** Puts our buttons into every tab row of the left sidebar. Safe to call any time. */
	private refresh() {
		const hosts = this.hosts();
		const live = new Set(hosts.map((h) => h.rowEl));

		for (const [rowEl, c] of this.controls) {
			if (!live.has(rowEl) || !rowEl.isConnected) {
				if (c.primary) this.restoreSelect();
				c.el.remove();
				rowEl.removeClass("osm-row");
				this.controls.delete(rowEl);
			}
		}

		for (const host of hosts) {
			let c = this.controls.get(host.rowEl);
			if (c && c.primary !== host.primary) {
				if (c.primary) this.restoreSelect();
				c.el.remove();
				c = undefined;
			}
			if (!c) {
				c = this.buildControls(host);
				if (!c.el.hasChildNodes()) continue;
				this.controls.set(host.rowEl, c);
			}
			host.rowEl.addClass("osm-row");
			if (!c.el.isConnected || c.el.parentElement !== host.rowEl) host.place(c.el);
			if (c.actionsEl && !this.popover.isOpen) c.actionsEl.toggleClass("is-disabled", !navButtonsOf(host.activeLeaf()));
		}

		this.hideReplacedNatives();
	}

	private hosts(): Host[] {
		const split = this.app.workspace.leftSplit;
		const drawer = asMobileDrawer(split);
		if (drawer) {
			return [
				{
					rowEl: drawer.tabsContainerEl,
					primary: true,
					activeLeaf: () => drawer.children[drawer.currentTab],
					place: (el) => drawer.tabsContainerEl.appendChild(el),
				},
			];
		}
		return tabGroupsIn(split).map((group, i) => ({
			rowEl: group.tabHeaderContainerEl,
			primary: i === 0,
			activeLeaf: () => group.children[group.currentTab],
			place: (el) => {
				const spacer = group.tabHeaderContainerEl.querySelector(":scope > .workspace-tab-header-spacer");
				if (spacer) spacer.after(el);
				else group.tabHeaderContainerEl.appendChild(el);
			},
		}));
	}

	private leftSplitEl(): HTMLElement {
		return (this.app.workspace.leftSplit as unknown as { containerEl: HTMLElement }).containerEl;
	}

	private mobileDrawer(): MobileDrawer | null {
		return asMobileDrawer(this.app.workspace.leftSplit);
	}

	// --- our buttons -------------------------------------------------------------------------

	private buildControls(host: Host): Controls {
		const el = createDiv("osm-controls");
		let actionsEl: HTMLElement | null = null;

		if (this.settings.groupActions) {
			actionsEl = this.button(el, "lucide-ellipsis", "Actions", "osm-actions");
			const a = actionsEl;
			a.addEventListener("click", (e) => {
				e.preventDefault();
				if (a.hasClass("is-disabled") && !this.popover.isOpen) this.refresh();
				this.popover.toggle(a, host.activeLeaf());
			});
		}
		if (host.primary && this.settings.vaultInRow) this.buildVaultButton(el);
		if (host.primary && this.settings.settingsInRow) {
			this.button(el, "lucide-settings", "Settings", "osm-settings").addEventListener("click", (e) => {
				e.preventDefault();
				openSettings(this.app);
			});
		}
		return { el, primary: host.primary, actionsEl };
	}

	private button(parent: HTMLElement, icon: string, label: string, cls: string): HTMLElement {
		const b = parent.createDiv(`clickable-icon osm-button ${cls}`);
		setIcon(b, icon);
		setTooltip(b, label);
		return b;
	}

	private buildVaultButton(parent: HTMLElement) {
		const name = this.app.vault.getName();
		const b = this.button(parent, "vault", `Vault: ${name}`, "osm-vault");

		if (Platform.isMobile) {
			// Obsidian's mobile vault picker is a hidden <select> laid over the vault name. Lend it
			// to our button so a tap opens the same picker with the same handlers.
			const select = this.mobileDrawer()?.headerEl.querySelector<HTMLElement>(".workspace-drawer-header-switcher select");
			if (select && !this.borrowedSelect) {
				this.borrowedSelect = { el: select, parent: select.parentNode!, next: select.nextSibling };
				b.appendChild(select);
			}
			return;
		}

		// Desktop: the same menu Obsidian's footer switcher builds. Its own switcher can't be
		// reused while hidden: Obsidian closes a menu as soon as the element it belongs to is hidden.
		b.addEventListener("click", (e) => {
			e.preventDefault();
			if (b.hasClass("has-active-menu")) return;
			const vaults = desktopVaults();
			if (!vaults) return;
			const menu = new Menu();
			for (const v of vaults.list) {
				menu.addItem((item) =>
					item
						.setTitle(v.name)
						.setChecked(v.path === vaults.current)
						.onClick(() => {
							if (v.path !== vaults.current && !vaults.open(v.path)) new Notice("Failed to open vault");
						})
				);
			}
			menu.addSeparator();
			menu.addItem((item) => item.setTitle("Manage vaults…").setIcon("open-vault").onClick(() => openVaultChooser(this.app)));
			const r = b.getBoundingClientRect();
			menu.setParentElement(b).showAtPosition({ x: r.left, y: r.bottom + 4 });
		});
	}

	private restoreSelect() {
		if (!this.borrowedSelect) return;
		const { el, parent, next } = this.borrowedSelect;
		if (parent.isConnected) parent.insertBefore(el, next && next.parentNode === parent ? next : null);
		this.borrowedSelect = null;
	}

	/** Hides the native buttons ours stand in for. */
	private hideReplacedNatives() {
		const hide = (el: Element | null | undefined) => {
			if (!(el instanceof HTMLElement) || this.hidden.has(el)) return;
			el.addClass("osm-hidden");
			this.hidden.add(el);
		};
		const { vaultInRow, settingsInRow } = this.settings;
		const drawer = this.mobileDrawer();
		if (drawer) {
			// Phones: the header only holds the vault name, file counts and settings, so it goes
			// as a whole. Tablets keep it for the pin button.
			if (Platform.isPhone && vaultInRow && settingsInRow && this.borrowedSelect) return hide(drawer.headerEl);
			if (settingsInRow) hide(drawer.headerEl.querySelector(".workspace-drawer-header-icon.mod-settings"));
			if (vaultInRow && this.borrowedSelect) hide(drawer.headerEl.querySelector(".workspace-drawer-header-left"));
			return;
		}
		// Desktop: the sidebar footer holds the vault switcher, help and settings. With both of
		// ours in the tab row the footer goes; help stays in the command palette.
		const profile = this.leftSplitEl().querySelector(".workspace-sidedock-vault-profile");
		if (!profile) return;
		if (vaultInRow && settingsInRow) return hide(profile);
		if (vaultInRow) hide(profile.querySelector(".workspace-drawer-vault-switcher"));
		if (settingsInRow) hide(profile.querySelector(".workspace-drawer-vault-actions .lucide-settings")?.closest(".clickable-icon"));
	}
}
