import { debounce, Menu, Platform, Plugin, setIcon, setTooltip, WorkspaceLeaf } from "obsidian";
import { Dropdown, DropdownContent, navButtonsOf, placeBeside, submenuPoint, withInAppMenus } from "./dropdown";
import { KeyboardInset } from "./keyboard";
import {
	asMobileDrawer,
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
	// Closing a drop-down can change a view's header (e.g. its search filter switched on).
	private dropdown = new Dropdown(() => this.requestRefresh());
	private keyboard: KeyboardInset | null = null;
	/** Native elements we hid because ours replace them. */
	private hidden = new Set<HTMLElement>();
	/** View headers we've marked `osm-empty-nav-header`. */
	private emptyHeaders = new Set<HTMLElement>();
	/** Sidebar containers marked with `osm-sidebar`. */
	private marked = new Set<HTMLElement>();

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
		const saved = (await this.loadData()) as Partial<SidebarManagerSettings> | null;
		// Only known keys, so settings from older versions don't linger in data.json.
		this.settings = { ...DEFAULT_SETTINGS };
		for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SidebarManagerSettings)[]) {
			if (saved?.[key] !== undefined) Object.assign(this.settings, { [key]: saved[key] });
		}
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
			this.keyboard = new KeyboardInset(() =>
				this.sidebars().flatMap((split) => asMobileDrawer(split)?.containerEl ?? [])
			);
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
		for (const el of this.hidden) el.removeClass("osm-hidden", "osm-collapsed");
		this.hidden.clear();
		for (const el of this.marked) el.removeClass("osm-sidebar");
		for (const el of this.emptyHeaders) el.removeClass("osm-empty-nav-header");
		this.emptyHeaders.clear();
		this.marked.clear();
		document.body.removeClass(...BODY_CLASSES);
	}

	/** Puts our buttons into every tab row of the managed sidebars. Safe to call any time. */
	private refresh() {
		// Marks the sidebars our styles apply to.
		for (const split of this.sidebars()) {
			const el = (split as { containerEl?: HTMLElement }).containerEl;
			if (el && !this.marked.has(el)) {
				el.addClass("osm-sidebar");
				this.marked.add(el);
			}
		}
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
		if (!this.dropdown.isOpen) this.markEmptyNavHeaders(hosts);
	}

	/**
	 * With view actions in the menu, a view header that held nothing but those buttons would be an
	 * empty strip: mark it so it can be hidden. (Done here rather than with a CSS has-selector, which is
	 * slow to re-evaluate.) Hidden children, like a search filter that's switched off, don't count.
	 */
	private markEmptyNavHeaders(hosts: Host[]) {
		if (!this.settings.groupActions) return;
		for (const leaf of hosts.flatMap((h) => h.leaves())) {
			const header = leaf.view?.containerEl.querySelector<HTMLElement>(".nav-header");
			if (!header) continue;
			const empty = Array.from(header.children).every(
				(c) => c.hasClass("nav-buttons-container") || (c as HTMLElement).style.display === "none"
			);
			header.toggleClass("osm-empty-nav-header", empty);
			this.emptyHeaders.add(header);
		}
	}

	/** The sidebars this plugin manages, per the "Apply to" setting. */
	private sidebars(): unknown[] {
		const { leftSplit, rightSplit } = this.app.workspace;
		const which = this.settings.sidebars;
		return [which !== "right" ? leftSplit : null, which !== "left" ? rightSplit : null].filter((x) => x !== null);
	}

	private managesLeft(): boolean {
		return this.settings.sidebars !== "right";
	}

	private hosts(): Host[] {
		// Only the left sidebar's first row gets the vault and settings sections.
		const left = this.app.workspace.leftSplit;
		return this.sidebars().flatMap((split) => this.hostsIn(split, split === left));
	}

	private hostsIn(split: unknown, isLeft: boolean): Host[] {
		const drawer = asMobileDrawer(split);
		if (drawer) {
			return [
				{
					rowEl: drawer.tabsContainerEl,
					tabsEl: drawer.tabsListEl,
					primary: isLeft,
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
			primary: isLeft && i === 0,
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

		if (s.groupActions || (host.primary && s.vaultAndSettings === "menu")) {
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
			// The plugin's styles can land after the first measurement; measure again once they have.
			window.setTimeout(() => {
				if (!this.dropdown.isOpen) this.fitTabs(c);
			}, 300);
		}
		return c;
	}

	private removeControls(c: Controls) {
		c.resizeObserver?.disconnect();
		c.menuEl?.remove();
		c.overflowEl?.remove();
		c.host.rowEl.removeClass("osm-row");
		c.host.rowEl.setCssProps({ "--osm-tab-height": "" });
		for (const leaf of c.host.leaves()) tabHeaderOf(leaf)?.removeClass("osm-overflowed");
	}

	/** Built like a view's tab header, so it gets the theme's tab size, colours, hover and open state. */
	private button(icon: string, label: string, cls: string): HTMLElement {
		const b = createDiv(`workspace-tab-header tappable osm-button ${cls}`);
		const inner = b.createDiv("workspace-tab-header-inner");
		setIcon(inner.createDiv("workspace-tab-header-inner-icon"), icon);
		setTooltip(b, label);
		// Don't take focus: on mobile that would close the keyboard of a search field being typed in.
		b.addEventListener("mousedown", (e) => e.preventDefault());
		return b;
	}

	// --- the menu ----------------------------------------------------------------------------

	private menuHasContent(host: Host): boolean {
		const s = this.settings;
		return (s.groupActions && !!navButtonsOf(host.activeLeaf())) || (host.primary && s.vaultAndSettings === "menu");
	}

	/** Sections: the view's actions; the vault submenu; settings. */
	private renderMenu(host: Host, d: DropdownContent) {
		const s = this.settings;
		if (s.groupActions) {
			const buttons = navButtonsOf(host.activeLeaf());
			if (buttons) d.borrow(buttons);
		}
		if (!host.primary) return;
		if (s.vaultAndSettings === "menu") {
			// The vaults sit one level down, so a stray tap can't switch vaults. "Manage vaults…" is
			// in that submenu too, as in Obsidian's own vault menu.
			d.section();
			d.item({
				icon: "vault",
				label: `Vault: ${this.app.vault.getName()}`,
				submenu: true,
				onClick: (itemEl) => this.showVaultMenu(itemEl),
			});
			d.section();
			d.item({ icon: "lucide-settings", label: "Settings", onClick: () => openSettings(this.app) });
		}
	}

	/** Obsidian's own menu: beside the item on desktop, a sheet from the bottom on phones. */
	/**
	 * Mobile: Obsidian's menu (a sheet on phones), listing the vaults from Obsidian's own vault
	 * picker, then "Manage vaults…" like the desktop menu.
	 * Desktop: Obsidian's own vault menu, opened from the (hidden) sidebar footer's vault switcher
	 * and moved beside the item.
	 */
	private showVaultMenu(itemEl: HTMLElement) {
		if (Platform.isMobile) {
			const menu = new Menu();
			for (const v of this.mobileVaults()) {
				menu.addItem((i) => i.setTitle(v.name).setIcon("vault").setChecked(v.current).onClick(() => v.open()));
			}
			menu.addSeparator();
			menu.addItem((i) => i.setTitle("Manage vaults…").setIcon("open-vault").onClick(() => openVaultChooser(this.app)));
			menu.setParentElement(itemEl).showAtPosition(submenuPoint(itemEl), itemEl.doc);
			return;
		}

		const native = this.leftSplitEl().querySelector<HTMLElement>(".workspace-sidedock-vault-profile .workspace-drawer-vault-switcher");
		if (!native) return openVaultChooser(this.app);
		const at = submenuPoint(itemEl);
		withInAppMenus(() =>
			native.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: at.x, clientY: at.y }))
		);
		// The menu belongs to the native switcher; mirror its open state on our item, which keeps
		// the drop-down open until the menu closes.
		itemEl.addClass("has-active-menu");
		window.setTimeout(() => {
			if (!native.hasClass("has-active-menu")) return itemEl.removeClass("has-active-menu");
			placeBeside(itemEl);
			const watcher = new MutationObserver(() => {
				if (native.hasClass("has-active-menu")) return;
				watcher.disconnect();
				itemEl.removeClass("has-active-menu");
			});
			watcher.observe(native, { attributes: true, attributeFilter: ["class"] });
		}, 0);
	}

	/** The vaults in Obsidian's mobile vault picker, a hidden <select> in the drawer header. */
	private mobileVaults(): Vault[] {
		// Picking a vault is a "change" on the <select>, which Obsidian handles (switch + reload).
		const select = this.mobileDrawer()?.headerEl.querySelector<HTMLSelectElement>(".workspace-drawer-header-switcher select");
		const list: Vault[] = Array.from(select?.options ?? [])
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
		if (!list.some((v) => v.current)) list.unshift({ name: this.app.vault.getName(), current: true, open: () => {} });
		return list;
	}

	// --- views that don't fit ----------------------------------------------------------------

	/**
	 * Hides the views that don't fit the row, last first, and shows the overflow button for them.
	 * The current view always stays in the row: if it would be hidden, it takes the place of the
	 * last view that fits, and that one goes to the overflow list instead.
	 */
	private fitTabs(c: Controls) {
		const { host, overflowEl } = c;
		if (!overflowEl) return;
		const headers = host.leaves().map((l) => tabHeaderOf(l)).filter((h): h is HTMLElement => !!h);
		headers.forEach((h) => h.removeClass("osm-overflowed"));
		overflowEl.hide();
		const tabsEl = host.tabsEl;
		if (!tabsEl.isConnected || tabsEl.clientWidth === 0) return;
		// Our buttons take the views' height (on desktop that comes from the tab strip around them).
		const height = headers[0]?.offsetHeight;
		if (height) host.rowEl.setCssProps({ "--osm-tab-height": `${height}px` });
		const overflows = () => tabsEl.scrollWidth > tabsEl.clientWidth + 1;
		if (!overflows()) return;

		overflowEl.show();
		const active = host.activeLeaf();
		const activeHeader = active ? tabHeaderOf(active) : null;
		for (let i = headers.length - 1; i >= 0 && overflows(); i--) {
			if (headers[i] !== activeHeader) headers[i].addClass("osm-overflowed");
		}
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
		if (!this.managesLeft() || this.settings.vaultAndSettings !== "menu") return;
		const drawer = this.mobileDrawer();
		if (drawer) {
			// Phones: the header only holds the vault name, file counts and settings, so it goes
			// as a whole. Tablets keep it for the pin button.
			if (Platform.isPhone) return hide(drawer.headerEl);
			hide(drawer.headerEl.querySelector(".workspace-drawer-header-icon.mod-settings"));
			hide(drawer.headerEl.querySelector(".workspace-drawer-header-left"));
			return;
		}
		// Desktop: the sidebar footer holds the vault switcher, help and settings; it goes as a
		// whole (help stays in the command palette). Collapsed rather than display: none, so the
		// vault switcher in it can still open its menu (Obsidian closes menus of hidden elements).
		const profile = this.leftSplitEl().querySelector<HTMLElement>(".workspace-sidedock-vault-profile");
		if (profile && !this.hidden.has(profile)) {
			profile.addClass("osm-collapsed");
			this.hidden.add(profile);
		}
	}
}
