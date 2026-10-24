import { debounce, Notice, Platform, Plugin, setIcon, setTooltip, WorkspaceLeaf } from "obsidian";
import { Dropdown, DropdownContent, navButtonsOf } from "./dropdown";
import { KeyboardInset } from "./keyboard";
import {
	asMobileDrawer,
	desktopVaults,
	MobileDrawer,
	openSettings,
	openVaultChooser,
	tabGroupsIn,
	tabHeaderOf,
} from "./obsidian-internals";
import { DEFAULT_SETTINGS, SidebarManagerSettings, SidebarManagerSettingTab } from "./settings";

/** A row of view tabs in the left sidebar that gets our buttons. */
interface Host {
	rowEl: HTMLElement;
	/** The element holding the view buttons; views that don't fit in it go to the overflow list. */
	tabsEl: HTMLElement;
	/** The first row also gets the vault and settings sections in its menu. */
	primary: boolean;
	/** Whether this row shows views as buttons (phones can keep Obsidian's selector instead). */
	tabButtons: boolean;
	leaves(): WorkspaceLeaf[];
	activeLeaf(): WorkspaceLeaf | undefined;
	select(leaf: WorkspaceLeaf): void;
	placeMenu(el: HTMLElement): void;
}

interface Controls {
	host: Host;
	menuEl: HTMLElement | null;
	overflowEl: HTMLElement | null;
	resizeObserver: ResizeObserver | null;
}

interface Vault {
	name: string;
	current: boolean;
	open(): void;
}

const BODY_CLASSES = ["osm-mobile-tabs", "osm-row-top", "osm-row-bottom", "osm-group-actions"];

export default class SidebarManagerPlugin extends Plugin {
	settings: SidebarManagerSettings = { ...DEFAULT_SETTINGS };

	private controls = new Map<HTMLElement, Controls>();
	private dropdown = new Dropdown();
	private keyboard: KeyboardInset | null = null;
	/** Native elements we hid because ours replace them. */
	private hidden = new Set<HTMLElement>();

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

		if (Platform.isMobile && s.keyboardFix) {
			this.keyboard = new KeyboardInset(() => this.mobileDrawer()?.containerEl ?? null);
			this.keyboard.start();
		}
		this.refresh();
	}

	private teardown() {
		this.dropdown.close();
		this.keyboard?.stop();
		this.keyboard = null;
		for (const c of this.controls.values()) this.removeControls(c);
		this.controls.clear();
		for (const el of this.hidden) el.removeClass("osm-hidden");
		this.hidden.clear();
		document.body.removeClass(...BODY_CLASSES);
	}

	/** Puts our buttons into every tab row of the left sidebar. Safe to call any time. */
	private refresh() {
		const hosts = this.hosts();
		const byRow = new Map(hosts.map((h) => [h.rowEl, h]));

		for (const [rowEl, c] of this.controls) {
			const host = byRow.get(rowEl);
			if (!host || !rowEl.isConnected || host.primary !== c.host.primary) {
				this.removeControls(c);
				this.controls.delete(rowEl);
			}
		}

		for (const host of hosts) {
			let c = this.controls.get(host.rowEl);
			if (!c) {
				c = this.buildControls(host);
				this.controls.set(host.rowEl, c);
			}
			c.host = host;
			host.rowEl.addClass("osm-row");
			if (c.menuEl && c.menuEl.parentElement !== host.rowEl) host.placeMenu(c.menuEl);
			if (c.overflowEl && c.overflowEl.previousElementSibling !== host.tabsEl) host.tabsEl.after(c.overflowEl);
			if (c.menuEl && !this.dropdown.isOpen) c.menuEl.toggleClass("is-disabled", !this.menuHasContent(host));
			if (!this.dropdown.isOpen) this.fitTabs(c);
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
					tabsEl: drawer.tabsListEl,
					primary: true,
					tabButtons: this.settings.mobileTabButtons,
					leaves: () => drawer.children,
					activeLeaf: () => drawer.children[drawer.currentTab],
					select: (leaf) => {
						// What Obsidian does when a view is picked from its selector.
						drawer.selectTabIndex(drawer.children.indexOf(leaf));
						if (Platform.isPhone || !drawer.isPinned) this.app.workspace.setActiveLeaf(leaf, { focus: true });
					},
					placeMenu: (el) => drawer.tabsContainerEl.appendChild(el),
				},
			];
		}
		return tabGroupsIn(split).map((group, i) => ({
			rowEl: group.tabHeaderContainerEl,
			tabsEl: group.tabsInnerEl,
			primary: i === 0,
			tabButtons: true,
			leaves: () => group.children,
			activeLeaf: () => group.children[group.currentTab],
			select: (leaf) => {
				group.selectTabIndex(group.children.indexOf(leaf));
				this.app.workspace.setActiveLeaf(leaf, { focus: true });
			},
			placeMenu: (el) => {
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
		const c: Controls = { host, menuEl: null, overflowEl: null, resizeObserver: null };
		const s = this.settings;

		if (s.groupActions || (host.primary && (s.vaultInMenu || s.settingsInMenu))) {
			const menuEl = (c.menuEl = this.button("lucide-ellipsis", "Menu", "osm-menu"));
			menuEl.addEventListener("click", (e) => {
				e.preventDefault();
				this.dropdown.toggle(menuEl, (d) => this.renderMenu(c.host, d));
			});
		}

		if (host.tabButtons) {
			// A chevron rather than a second "…": it lists the views that didn't fit.
			const overflowEl = (c.overflowEl = this.button("lucide-chevron-down", "More views", "osm-overflow"));
			overflowEl.hide();
			overflowEl.addEventListener("click", (e) => {
				e.preventDefault();
				this.dropdown.toggle(overflowEl, (d) => this.renderOverflow(c.host, d));
			});
			c.resizeObserver = new ResizeObserver(() => {
				if (!this.dropdown.isOpen) this.fitTabs(c);
			});
			c.resizeObserver.observe(host.rowEl);
		}
		return c;
	}

	private removeControls(c: Controls) {
		c.resizeObserver?.disconnect();
		c.menuEl?.remove();
		c.overflowEl?.remove();
		c.host.rowEl.removeClass("osm-row");
		for (const leaf of c.host.leaves()) tabHeaderOf(leaf)?.removeClass("osm-overflowed");
	}

	private button(icon: string, label: string, cls: string): HTMLElement {
		const b = createDiv(`clickable-icon osm-button ${cls}`);
		setIcon(b, icon);
		setTooltip(b, label);
		return b;
	}

	// --- the menu ----------------------------------------------------------------------------

	private menuHasContent(host: Host): boolean {
		const s = this.settings;
		return (s.groupActions && !!navButtonsOf(host.activeLeaf())) || (host.primary && (s.vaultInMenu || s.settingsInMenu));
	}

	/** Sections: the view's actions; the vaults; "Manage vaults…" and settings. */
	private renderMenu(host: Host, d: DropdownContent) {
		const s = this.settings;
		if (s.groupActions) {
			const buttons = navButtonsOf(host.activeLeaf());
			if (buttons) d.borrow(buttons);
		}
		if (!host.primary) return;
		if (s.vaultInMenu) {
			d.section();
			for (const v of this.vaults()) d.item({ icon: "vault", label: v.name, checked: v.current, onClick: () => v.open() });
		}
		d.section();
		if (s.vaultInMenu) d.item({ icon: "open-vault", label: "Manage vaults…", onClick: () => openVaultChooser(this.app) });
		if (s.settingsInMenu) d.item({ icon: "lucide-settings", label: "Settings", onClick: () => openSettings(this.app) });
	}

	private vaults(): Vault[] {
		let list: Vault[] = [];
		if (Platform.isMobile) {
			// Obsidian's mobile vault picker is a hidden <select>; its options are the vaults, and
			// picking one is a "change" on it, which Obsidian handles (switch + reload).
			const select = this.mobileDrawer()?.headerEl.querySelector<HTMLSelectElement>(".workspace-drawer-header-switcher select");
			list = Array.from(select?.options ?? [])
				.filter((o) => o.value !== "manage-vaults")
				.map((o) => ({
					name: o.text,
					current: o.selected,
					open: () => {
						if (o.selected || !select) return;
						select.value = o.value;
						select.dispatchEvent(new Event("change"));
					},
				}));
		} else {
			const vaults = desktopVaults();
			list = (vaults?.list ?? []).map((v) => ({
				name: v.name,
				current: v.path === vaults!.current,
				open: () => {
					if (v.path !== vaults!.current && !vaults!.open(v.path)) new Notice("Failed to open vault");
				},
			}));
		}
		if (!list.some((v) => v.current)) list.unshift({ name: this.app.vault.getName(), current: true, open: () => {} });
		return list;
	}

	// --- views that don't fit ----------------------------------------------------------------

	/** Hides the views that don't fit the row, last first, and shows the overflow button for them. */
	private fitTabs(c: Controls) {
		const { host, overflowEl } = c;
		if (!overflowEl) return;
		const headers = host.leaves().map((l) => tabHeaderOf(l)).filter((h): h is HTMLElement => !!h);
		headers.forEach((h) => h.removeClass("osm-overflowed"));
		overflowEl.hide();
		const tabsEl = host.tabsEl;
		if (!tabsEl.isConnected || tabsEl.clientWidth === 0) return;
		const overflows = () => tabsEl.scrollWidth > tabsEl.clientWidth + 1;
		if (!overflows()) return;

		overflowEl.show();
		for (let i = headers.length - 1; i > 0 && overflows(); i--) headers[i].addClass("osm-overflowed");
		const active = host.activeLeaf();
		overflowEl.toggleClass("is-active", !!active && !!tabHeaderOf(active)?.hasClass("osm-overflowed"));
	}

	private renderOverflow(host: Host, d: DropdownContent) {
		const active = host.activeLeaf();
		for (const leaf of host.leaves()) {
			if (!tabHeaderOf(leaf)?.hasClass("osm-overflowed")) continue;
			d.item({ icon: leaf.getIcon(), label: leaf.getDisplayText(), checked: leaf === active, onClick: () => host.select(leaf) });
		}
	}

	// --- native elements ours replace --------------------------------------------------------

	private hideReplacedNatives() {
		const hide = (el: Element | null | undefined) => {
			if (!(el instanceof HTMLElement) || this.hidden.has(el)) return;
			el.addClass("osm-hidden");
			this.hidden.add(el);
		};
		const { vaultInMenu, settingsInMenu } = this.settings;
		const drawer = this.mobileDrawer();
		if (drawer) {
			// Phones: the header only holds the vault name, file counts and settings, so it goes
			// as a whole. Tablets keep it for the pin button.
			if (Platform.isPhone && vaultInMenu && settingsInMenu) return hide(drawer.headerEl);
			if (settingsInMenu) hide(drawer.headerEl.querySelector(".workspace-drawer-header-icon.mod-settings"));
			if (vaultInMenu) hide(drawer.headerEl.querySelector(".workspace-drawer-header-left"));
			return;
		}
		// Desktop: the sidebar footer holds the vault switcher, help and settings. With both in the
		// menu the footer goes; help stays in the command palette.
		const profile = this.leftSplitEl().querySelector(".workspace-sidedock-vault-profile");
		if (!profile) return;
		if (vaultInMenu && settingsInMenu) return hide(profile);
		if (vaultInMenu) hide(profile.querySelector(".workspace-drawer-vault-switcher"));
		if (settingsInMenu) hide(profile.querySelector(".workspace-drawer-vault-actions .lucide-settings")?.closest(".clickable-icon"));
	}
}
